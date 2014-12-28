var request = require("request").defaults({
    jar: true
});
var fs = require('fs');
var cheerio = require('cheerio');
var _ = require('underscore');
var fs = require('fs');
var async = require('async');
var mkdirp = require('mkdirp');
var blobSvc = require('azure-storage').createBlobService();
blobSvc.createContainerIfNotExists('mixergydl', function(error){
    if(!error){
        console.log('Azure storage created')
    }
});

var VIDEO_TYPES = [
    'flv',
    'iphone',
    'hdflv',
    'hdmp4',
    'still',
    'original',
    'preview'
];

var LOGIN_URL = 'https://mixergy.com/wp-login.php?wpe-login=mixergy';
var COOKIES;

mkdirp('videos');
request.post({
    url: LOGIN_URL,
    form: {
        log: process.env.MIXERGY_USERNAME,
        pwd: process.env.MIXERGY_PASSWORD,
        testcookie: 1,
        'wp-submit': 'Log In'
    }
}, function(error, response, body) {
    request("https://www.kimonolabs.com/api/60slzlww?apikey=dokWpGAvcSxKiPdtLkHmHh7eDuy0sMOk",
        function(err, response, body) {
            if (!err) {
                var docs = JSON.parse(body);
                console.log('Detected ' + docs.count + ' interviews.');

                var oneInterview = [docs.results.interviews[40]];
                // _.forEach(oneInterview, function(obj){
                var threads = 2;
                async.eachLimit(docs.results.interviews, threads, function(obj, next){
                  processInterview(obj, next);
                }, function(){
                   console.log('Finished!');
                })
            }
        });
});

function processInterview(obj, cb){
    request({
        url: obj.Title.href,
        method: "GET"
    }, function(error, response, body) {
        var $ = cheerio.load(body);

        var iframe = $('iframe');
        var isPremium = $('div#banner-go-premium').length === 0 ? true : false;

        if (!isPremium) {
            console.log('You are not on premium subscription.');
        }

        if (!iframe.length) {
            console.log('Cannot download this video: ' + obj['Episode Number']);
            return false;
        }

        var vid_url = 'http:' + $('iframe').attr('src');

        request({
            url: vid_url,
            method: 'GET'
        }, function(err, res, body) {
            var wistia = body.match(/\{"assets(.*)}}/g);
            var videos = JSON.parse(String(wistia[0]));
            var filename = 'videos/' + String(obj['Episode Number']) + '.flv';
            console.log('Video can be downloaded: ' + obj['Episode Number']);

            download(filename, videos.assets.flv.url, cb);
        });
    });
}

function download(localFile, remotePath, callback) {
    // var localStream = fs.createWriteStream(localFile);
    var writeStream = blobSvc.createWriteStreamToBlockBlob(
                'mixergydl',
                localFile,
                { contentType: 'video/flv' },
                function(error, result, response){
                    if(error){
                        console.error(error);
                    }
                });
    var out = request({
        uri: remotePath
    });
    out.on('response', function(resp) {
        if (resp.statusCode === 200) {
            out.pipe(writeStream);
            writeStream.on('close', function() {
                console.log('Done downloading: ' + localFile);
                callback();
            });
        }
    })
};

// var writeStream = blobService.createWriteStreamToBlockBlob(
//             containerName,
//             fileName,
//             { contentType: 'text/html' },
//             function(error, result, response){
//                 if(error){
//                     console.log("Couldn't upload file %s from %s", fileName, domain);
//                     console.error(error);
//                 } else {
//                     console.log('File %s from %s uploaded', fileName, domain);
//                 }
//             });

