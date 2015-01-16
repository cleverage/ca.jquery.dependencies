(function ($) {
  'use strict';

  $('#log').append('test.b.js loaded\n');

  $.fn.b = function () {
    $('#log')
      .append('b has been called: ' + arguments[0].toString() + '\n');

    return this;
  };
})(jQuery);
