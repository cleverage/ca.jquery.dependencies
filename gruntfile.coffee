module.exports = (grunt) ->

  # ALIASES
  # ============================================================================
  grunt.registerTask 'live',  ['connect']


  # AUTOMATED TASTK LOADING
  # ============================================================================
  require('load-grunt-tasks')(grunt)


  # CONFIG
  # ============================================================================
  grunt.initConfig
    connect:
      options:
        hostname: '*'

      test:
        options :
          port       : 8000
          keepalive  : true
          base       : ''
