(function ($) {
  'use strict';

  // ENV
  // --------------------------------------------------------------------------

  // A list of human readable, easier to manipulate, names for dependencies
  var DEP_NAME = {};

  // Dependencies are indexed by URL
  //
  // Each dependencies record:
  // * loader : A Deffered object handling the loading of the resource
  // * lazy   : An Array of function name (or false if no JIT load)
  // * require: An Array of dependencies name required to load that dependency
  var DEP_LIST = {};


  // UTILS
  // --------------------------------------------------------------------------
  function record(dep) {
    var list   = [];
    function stringRecorder(i, url) {
      if (!(url in DEP_LIST)) {
        $.extend(DEP_LIST, normalize(url));

        if (hasCircularDependencies(url)) {
          throw new Error('Circular dependency detected: ' + url);
        }

        list.push(url);
      }
    }

    // dep can be an Array when there is a single dependency
    if (typeof dep === 'string') {
      stringRecorder(null, dep);
    }

    // dep can be an array of string for list of simple dependencies
    else if ($.isArray(dep)) {
      $.each(dep, stringRecorder);
    }

    else if ($.isPlainObject(dep)) {
      $.each(dep, function (k, value) {
        if (value.lazy === true) {
          value.lazy = k;
        }

        var v = normalize(value);

        if (!(value.url in DEP_LIST)) {
          $.extend(DEP_LIST, v);
          DEP_NAME[k] = value.url;

          if (hasCircularDependencies(value.url)) {
            throw new Error('Circular dependency detected: ' + value.url);
          }

          list.push(value.url);
        }
      });
    }

    return list;
  }

  // Normalize and sanitize a dependency record
  function normalize(dep) {
    var base = {lazy: false, loader: null, require: false};
    var obj  = {};

    if (typeof dep === 'string') {
      obj[dep] = $.extend({}, base);
    }

    else if ($.isPlainObject(dep) && 'url' in dep) {
      obj[dep.url] = {
        loader : null,
        lazy   : $.isArray(dep.lazy)             ?  dep.lazy     :
                 typeof dep.lazy === 'string'    ? [dep.lazy]    :
                 false,
        require: $.isArray(dep.require)          ?  dep.require  :
                 typeof dep.require === 'string' ? [dep.require] :
                 false
      };
    }

    return obj;
  }

  // Check for circular dependencies
  function hasCircularDependencies(url, circle) {
    var result = false;
    var topurl = circle || url;

    if (DEP_LIST[url].require) {
      $.each(DEP_LIST[url].require, function (i, v) {
        var url = DEP_NAME[v] || v;

        if (DEP_LIST[url]) {
          result = topurl === url || hasCircularDependencies(url, topurl);
        }
      });
    }

    return result;
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
        var url = DEP_NAME[val] || val,
            dep = DEP_LIST[url];

        function error() {
          result.reject('Unable to load: ' + url);
        }

        if (dep.lazy) {
          setUpLazy(dep.lazy, url);
          success();
        }

        else if (!dep.loader || dep.loader.state() === 'rejected') {
          if (dep.require) {
            load(dep.require).done(function () {
              if (!dep.loader) {
                dep.loader = $.ajax({
                  url: url,
                  dataType: 'script',
                  cache: true
                });
              }

              dep.loader.done(success).fail(error);
            });
          }

          else {
            dep.loader = $.ajax({
              url: url,
              dataType: 'script',
              cache: true
            }).done(success).fail(error);
          }
        }

        else {
          dep.loader.done(success).fail(error);
        }
      });
    });

    return result;
  }

  function setUpLazy(fns, url) {
    $.each(fns, function (i, fn) {
      if(!$.fn[fn]) {
        $.fn[fn] = function () {
          var that = bust(this, fn);
          var args = arguments;

          DEP_LIST[url].lazy = false;

          load([url]).done(function () {
            $.fn[fn].apply(that._that, args);
            that._unbust();
          });

          return that;
        };
      }
    });
  }

  // TODO: This need to be seriously tested
  function bust(jqObj, fn) {
    var queue = [];
    var dummy = {
      _that  : jqObj,
      _unbust: function () {
        $.each(queue, function (i, obj) {
          jqObj = jqObj[obj.fn].apply(jqObj, obj.args);
        });

        dummy = jqObj;
      }
    };

    for(var key in jqObj) {
      (function (key) {
        if (key !== fn && $.isFunction(jqObj[key])) {
          dummy[key] = function () {
            queue.push({
              fn  : key,
              args: arguments
            });
          };
        } else {
          dummy[key] = jqObj[key];
        }
      })(key);
    }

    return dummy;
  }

  // PUBLIC API
  // --------------------------------------------------------------------------
  $.dependencies = function dependencies(dep) {
    return load(record(dep)).promise();
  };
})(jQuery);
