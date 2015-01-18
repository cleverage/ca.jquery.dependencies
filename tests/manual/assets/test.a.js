(function ($) {
  'use strict';

  $('#log').append('test.a.js loaded\n');

  $.fn.a = function () {
    $('#log')
      .append('a has been called: ' + arguments[0] + '\n');

    return this;
  };
})(jQuery);
