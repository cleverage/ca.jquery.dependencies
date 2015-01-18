(function ($) {
  'use strict';

  $('#log').append('test.c.js loaded\n');

  $.fn.c = function () {
    $('#log')
      .append('c has been called: ' + arguments[0] + '\n');

    return this;
  };
})(jQuery);
