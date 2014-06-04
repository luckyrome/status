module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            files: ['app/js/*.js']
        },
        copy: {
          deploy: {
            files: [
              {expand: true, cwd: "app", src: ['**/*'], dest: '/var/www/status/'},
            ]
          }
        },
        watch : {
            files : [
                'app/**'
            ],
            tasks : ['test', 'deploy']
        }
    });
    // concat was used at one point but I decided to keep it simple... for now
    // grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.registerTask('test', ['jshint']);
    grunt.registerTask('deploy', ['copy:deploy']);
    grunt.registerTask('default', ['test', 'deploy', 'watch']);

}