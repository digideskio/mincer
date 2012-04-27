/** internal
 *  class Context
 *
 *  `Context` provides helper methods to all [[EngineTemplate]] processors.
 *  They are typically accessed by EJS templates. You can mix in custom
 *  helpers by injecting them into [[Environment#contextClass]]. Do not
 *  mix them into `Context` directly.
 *
 *      environment.contextClass.prototype.asset_url = function () {
 *        // ...
 *      };
 *
 *      environment.contextClass.mixin(MyHelpersCollection);
 *
 *      <%= asset_url("foo.png") %>
 *
 *  The `Context` also collects dependencies declared by assets.
 *  See [[DirectiveProcessor]] for an example of this.
 **/


'use strict';


// stdlib
var path = require('path');


// 3rd-party
var _ = require('underscore');
var Set = require('types').Set;


// internal
var getter = require('./common').getter;
var prop   = require('./common').prop;


/**
 *  new Context(environment, logicalPath, pathname)
 **/
var Context = module.exports = function Context(environment, logicalPath, pathname) {
  prop(this, 'environment',           environment);
  prop(this, 'pathname',              pathname);

  prop(this, '__logicalPath__',       logicalPath);

  prop(this, '__requiredPaths__',     []);
  prop(this, '__stubbedAssets__',     new Set());
  prop(this, '__dependencyPaths__',   new Set());
  prop(this, '__dependencyAssets__',  new Set([pathname]));

  this.__LINE__ = null;
};


/**
 *  Context#rootPath -> String
 *
 *  Returns the environment path that contains the file.
 *
 *  If `app/javascripts` and `app/stylesheets` are in your path, and
 *  current file is `app/javascripts/foo/bar.js`, `root_path` would
 *  return `app/javascripts`.
 **/
getter(Context.prototype, 'rootPath', function () {
  var pathname = this.pathname;
  return _.find(this.environment.paths, function (path) {
    return pathname === path.substr(0, pathname.length);
  });
});



/**
 * Context#logicalPath -> String
 *
 *  Returns logical path without any file extensions.
 *
 *      'app/javascripts/application.js'
 *      # => 'application'
 **/
getter(Context.prototype, 'logicalPath', function () {
  var len = this.__logicalPath__.length, ext = path.extname(this.__logicalPath__);
  return this.__logicalPath__.substr(0, len - ext.length);
});


/**
 *  Context#contentType -> String
 *
 *  Returns content type of file
 *
 *      'application/javascript'
 *      'text/css'
 **/
getter(Context.prototype, 'contentType', function () {
  return this.environment.contentTypeOf(this.pathname);
});


Context.prototype.resolve = function (pathname, options, fn) {
  var self = this, attributes, content_type = options.contentType;

  if ('/' === pathname[0]) {
    return pathname;
  } else if (content_type) {
    if ('self' === options.contentType) {
      content_type = self.contentType;
    }

    attributes = this.environment.attributesFor(pathname);
    if (attributes.formatExtension && content_type !== attributes.contentType) {
      throw new Error(pathname + " is '" + attributes.contentType + "', " +
                      "not '" + content_type + "'");
    }

    this.resolve(pathname, {}, function (candidate) {
      if (self.contentType === self.environment.contentTypeOf(candidate)) {
        return candidate;
      }
    });
  } else {
    return this.environment.resolve(pathname, _.extend({
      basePath: path.dirname(this.pathname)
    }, options), fn);
  }
};


/**
 *  Context#dependOn(pathname) -> Void
 *
 *  Allows you to state a dependency on a file without including it.
 *
 *  This is used for caching purposes. Any changes made to
 *  the dependency file with invalidate the cache of the
 *  source file.
 **/
Context.prototype.dependOn = function (pathname) {
  this.__dependencyPaths__.push(this.resolve(pathname));
};


/**
 *  Context#dependOnAsset(pathname) -> Void
 *
 *  Allows you to state an asset dependency without including it.
 *
 *  This is used for caching purposes. Any changes that would
 *  invalidate the dependency asset will invalidate the source
 *  file. Unlike `depend_on`, this will include recursively include
 *  the target asset's dependencies.
 **/
Context.prototype.dependOnAsset = function (pathname) {
  this.__dependencyAssets__.push(this.resolve(pathname));
};


/**
 *  Context#requireAsset(pathname) -> Void
 *
 *  `require_asset` declares `path` as a dependency of the file. The
 *  dependency will be inserted before the file and will only be
 *  included once.
 *
 *  If EJS processing is enabled, you can use it to dynamically
 *  require assets.
 *
 *      <%= requireAsset("#{framework}.js") %>
 **/
Context.prototype.requireAsset = function (pathname) {
  pathname = this.resolve(pathname, {contentType: 'self'});
  this.dependOnAsset(pathname);
  this.__requiredPaths__.push(pathname);
};


/**
 *  Context#stubAsset(pathname) -> Void
 *
 *  `stubAsset` blacklists `pathname` from being included in the bundle.
 *  `pathname` must be an asset which may or may not already be included
 *  in the bundle.
 **/
Context.prototype.stubAsset = function (pathname) {
  this.__stubbedAssets__.push(this.resolve(pathname, {contentType: 'self'}));
};


/**
 *  Context#isAssetRequirable(pathname) -> Boolean
 *
 *  Tests if target path is able to be safely required into the
 *  current concatenation.
 **/
Context.prototype.isAssetRequirable = function (pathname) {
  var content_type, stat;

  pathname      = this.resolve(pathname);
  content_type  = this.environment.contentTypeOf(pathname);
  stat          = this.environment.stat(pathname);

  return stat && stat.isFile() &&
         (!this.contentType || this.contentType === content_type);
};


/**
 *  Context#assetDataUri(pathname) -> String
 *
 *  Returns a Base64-encoded `data:` URI with the contents of the
 *  asset at the specified path, and marks that path as a dependency
 *  of the current file.
 *
 *  Use `assetDataUri` from EJS with CSS or JavaScript assets:
 *
 *      #logo { background: url(<%= assetDataUri('logo.png') %>) }
 *
 *      $('<img>').attr('src', '<%= assetDataUri('avatar.jpg') %>')
 **/
Context.prototype.assetDataUri = function (pathname) {
  var asset = this.environment.findAsset(pathname),
      base64 = 'not-implemented-yet';

  // TODO: Implement base64 encoding
  this.dependOn(pathname);
  return "data:" + asset.contentType + ";base64," + base64;
};