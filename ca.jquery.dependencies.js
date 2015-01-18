(function ($) {
  'use strict';

  // ENV
  // --------------------------------------------------------------------------

  // Files are indexed by URL
  //
  // Each file record:
  // * name   : the name of the library (file name without '.js' by default)
  // * loader : A Deffered object handling the loading of the resource
  // * lazy   : An Array of function name (or false if no JIT load)
  // * require: An Array of FILES name required to load that library
  var FILES = {};


  // UTILS
  // --------------------------------------------------------------------------
  function record(libraries) {
    var list   = [];

    function recordOne(key, obj) {
      if (!(key in FILES)) {
        $.extend(FILES, normalize(key, obj));
        list.push(key);
      }
    }

    // dep can be an Array when there is a single dependency
    if (typeof libraries === 'string') {
      recordOne(libraries, libraries);
    }

    // dep can be an array of string for list of simple libraries
    else if ($.isArray(libraries)) {
      $.each(libraries, function (i, url) {
        recordOne(url, url);
      });
    }

    else if ($.isPlainObject(libraries)) {
      $.each(libraries, recordOne);
    }

    return list;
  }

  // Normalize and sanitize a library record
  function normalize(key, value) {
    var out  = {};
    var base = {
      name   : value.url ? key : key.slice(key.lastIndexOf('/') + 1, -3),
      lazy   : false,
      loader : null,
      require: false
    };

    if (!value || typeof value === 'string') {
      out[key] = $.extend({}, base);
    }

    else if ($.isArray(value)) {
      if (value.length) {
        base.require = value;
      }

      out[key] = $.extend({}, base);
    }

    else if ($.isPlainObject(value) && 'url' in value) {
      out[value.url] = {
        name   : key,
        loader : null,
        lazy   : $.isArray(value.lazy) && value.lazy.length > 0 ? value.lazy :
                 typeof value.lazy === 'string' ? [value.lazy] :
                 value.lazy === true ? [key] :
                 false,
        require: $.isArray(value.require) && value.require.length > 0 ? value.require :
                 typeof value.require === 'string' ? [value.require] :
                 false
      };
    }

    console.log(out);

    return out;
  }

  // Check for circular dependencies
  function hasCircularDependencies(url, circle) {
    var result = false;
    var topurl = circle || url;

    if (FILES[url].require) {
      $.each(FILES[url].require, function (i, v) {
        var url = v in FILES ? v : urlByName(v);

        if (FILES[url]) {
          result = topurl === url || hasCircularDependencies(url, topurl);
        }
      });
    }

    return result;
  }

  function urlByName(name) {
    var url;

    $.each(FILES, function (uri, file) {
      if (file.name === name) {
        url = uri;
      }
    });

    return url;
  }

  // LOAD
  // --------------------------------------------------------------------------
  function load(list) {
    var result = $.Deferred();
    var count  = 0;

    function success() {
      count++;

      if (count === list.length) {
        result.resolve();
      }
    }

    // We never load script before the DOM is ready
    $(function () {
      $.each(list, function (i, val) {
        var url   = val in FILES ? val : urlByName(val),
            file  = FILES[url],
            param = {
              url     : url,
              dataType: 'script',
              cache   : true
            };

        function error() {
          result.reject('Unable to load: ' + url);
        }

        if (!file) {
          result.reject('Unknown file: ' + val);
        }

        else if (file.loader && file.loader.state() !== 'rejected') {
          file.loader.done(success).fail(error);
        }

        else if (hasCircularDependencies(url)) {
          result.reject('Circular dependency detected: ' + url);
        }

        else if (file.lazy) {
          setUpLazy(file.lazy, url);
          success();
        }

        else if (file.require) {
          load(file.require).done(function () {
            if (!file.loader || file.loader.state() === 'rejected') {
              file.loader = $.ajax(param);
            }

            file.loader.done(success).fail(error);
          }).fail(error);
        }

        else {
          file.loader = $.ajax(param).done(success).fail(error);
        }
      });
    });

    return result;
  }

  function setUpLazy(fns, url) {
    $.each(fns, function (i, fn) {
      if(!$.fn[fn]) {
        $.fn[fn] = function () {
          var dummy = proxify(this, fn, arguments);

          FILES[url].lazy = false;

          load([url]).always(function () {
            dummy._deproxify();
          });

          return dummy;
        };
      }
    });
  }

  // TODO: This need to be seriously tested
  function proxify(jqObj, fn, args) {
    var timer = $.Deferred();

    timer.done(function () {
      jqObj = $.fn[fn].apply(jqObj, args);
    });

    var proxy = {
      _deproxify: function () {
        timer.resolve();
      }
    };

    function puppet(key) {
      if (!$.isFunction(jqObj[key])) {
        return jqObj[key];
      }

      return function () {
        var args = arguments;

        timer.done(function () {
          jqObj = $.fn[key].apply(jqObj, args);
        });

        return proxy;
      };
    }

    for(var key in jqObj) {
      proxy[key] = puppet(key);
    }

    return proxy;
  }

  // PUBLIC API
  // --------------------------------------------------------------------------
  $.dependencies = function dependencies(dep) {
    return load(record(dep)).promise();
  };
})(jQuery);
