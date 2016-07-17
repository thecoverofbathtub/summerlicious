let csv = require('csv');
let fs = require('fs');
let restaurantsLoader = require('./restaurants-loader');
let yelpLoader = require('./yelp-loader');

// const sourceUrl = 'http://www1.toronto.ca/wps/portal/contentonly?vgnextoid=04deaf2c85006410VgnVCM10000071d60f89RCRD&view=tabList';
const sourceUrl = 'http://www1.toronto.ca/wps/portal/contentonly?vgnextoid=befeaf2c85006410VgnVCM10000071d60f89RCRD';

function saveAsCsv(details) {
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

restaurantsLoader.run(sourceUrl, true)
    .then(restaurants => {
        return yelpLoader.run(restaurants, true);
    })
    .then(details => {
        saveAsCsv(details);
    })
    .catch(err => {
        console.error(err);
    });