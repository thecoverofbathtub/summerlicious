let async = require('async');
let csv = require('csv');
let fs = require('fs');
let restaurantsLoader = require('./restaurants-loader');
let yelpLoader = require('./yelp-loader');

function doSomething(details) {
    let csvContent = [];
    csvContent.push(['Name', 'Yelp Rating', 'Yelp Review Count', 'Yelp Link']);
    details.forEach(detail => {
        csvContent.push([detail.name, detail.stars, detail.count, detail.url]);
    });
    csv.stringify(csvContent, (err, output) => {
        fs.writeFileSync('./summerlicious.csv', output);
        console.log('CSV saved successfully ..');
    });
}

function getRestaurantName(callback) {
    restaurantsLoader.run(true)
        .then(
            restaurants => callback(null, restaurants),
            err => callback(err, [])
        );
}

function getRestaurantDetails(restaurants, callback) {
    yelpLoader.run(restaurants, true)
        .then(
            details => callback(null, details),
            err => callback(err, [])
        );
}

async.waterfall([
    getRestaurantName,
    getRestaurantDetails
], (err, details) => {
    if (err) {
        console.log(err);
        return;
    }
    console.log('Finished ..');
    doSomething(details);
});