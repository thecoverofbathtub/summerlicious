let cheerio = require('cheerio');
let fs = require('fs');
let phantom = require('phantom');
let Q = require('q');

const dumpPath = './restaurants.dump';

function getRestaurantNames(sourceUrl) {
    let realInstance, realPage;
    return phantom.create()
        .then(instance => {
            console.log("Restaurants page loading ..");
            realInstance = instance;
            return instance.createPage();
        })
        .then(page => {
            realPage = page;
            return page.open(sourceUrl);
        })
        .then(status => {
            console.log("Restaurants page load status: " + status);
            return realPage.property('content');
        })
        .then(content => {
            realPage.close();
            realInstance.exit();
            let restaurants = parseRestaurantsFromPage(content);
            restaurants.sort();
            return restaurants;
        });
}

function parseRestaurantsFromPage(pageHtml) {
    let restaurants = [];
    let $ = cheerio.load(pageHtml);
    $('.lic_restname').each((index, elem) => {
        restaurants.push($(elem).text());
    });
    return restaurants;
}

function serializeRestaurants(filePath, restaurants) {
    fs.writeFileSync(filePath, restaurants.join('\n'));
    console.log('Restaurants saved successfully..');
}

function deserializeRestaurants(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8').split('\n');
    } catch (ex) {
        return undefined;
    }
}

function run(sourceUrl, forceRefresh) {
    if (!forceRefresh) {
        let restaurants = deserializeRestaurants(dumpPath);
        if (restaurants) {
            return Q.resolve(restaurants);
        }
    }
    return getRestaurantNames(sourceUrl)
        .then(restaurants => {
            serializeRestaurants(dumpPath, restaurants);
            return restaurants;
        });
}

const RestaurantLoader = {
    run
};

Object.freeze(RestaurantLoader);
module.exports = RestaurantLoader;
