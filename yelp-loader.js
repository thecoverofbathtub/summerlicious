let async = require('async');
let cheerio = require('cheerio');
let fs = require('fs');
let superagent = require('superagent');
let url = require('url');
let Q = require('q');

const yelpTemplate = 'https://www.yelp.com/search?find_desc=${restaurant}&find_loc=Toronto%2C+ON&ns=1';
const yelpUrl = 'https://www.yelp.com';
const detailsDumpPath = './yelp.dump';
const failuresDumpPath = './failures.dump';
const concurrencyLimit = 50;

function getYelpSearchUrl(restaurant) {
    return yelpTemplate.replace('${restaurant}', encodeURI(restaurant));
}

function getRestaurantUrlFromSearchPage(pageHtml) {
    try {
        let $ = cheerio.load(pageHtml);
        let href = $('.indexed-biz-name > .biz-name').first().prop('href');
        return url.resolve(yelpUrl, href);
    } catch(ex) {
        return undefined;
    }
}

function getRestaurantDetailsFromPage(pageHtml) {
    try {
        let $ = cheerio.load(pageHtml);
        let reviewStars = $('.rating-very-large > meta').first().prop('content');
        let reviewCount = $('.review-count').first().text().trim();
        return {
            count: parseInt(reviewCount.match(/([0-9]*)\s.*/)[1]),
            stars: parseFloat(reviewStars)
        };
    } catch(ex) {
        return undefined;
    }
}

function serializeFailures(filePath, failures) {
    fs.writeFileSync(filePath, JSON.stringify(failures, null, 4));
    console.log('Failed restaurants saved successfully..');
}

function serializeDetails(filePath, details) {
    fs.writeFileSync(filePath, JSON.stringify(details, null, 4));
    console.log('Restaurant details saved successfully..');
}

function deserializeDetails(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch(ex) {
        return undefined;
    }
}

function getRestaurantDetailsUrl(restaurant) {
    let q = Q.defer();
    let restaurantSearchUrl = getYelpSearchUrl(restaurant);
    superagent.get(restaurantSearchUrl)
        .end((err, response) => {
            if (err) {
                q.reject(err);
                return;
            }
            let restaurantUrl = getRestaurantUrlFromSearchPage(response.text);
            if (!restaurantUrl) {
                q.reject("Unable to get restaurant url for: " + restaurant);
            }
            else {
                q.resolve(restaurantUrl);
            }
        });
    return q.promise;
}

function getRestaurantDetails(restaurantUrl) {
    let q = Q.defer();
    superagent.get(restaurantUrl)
        .end((err, response) => {
            if (err) {
                q.reject(err);
                return;
            }
            let details = getRestaurantDetailsFromPage(response.text);
            if (!details) {
                q.reject("Unable to get restaurant details at: " + restaurantUrl);
            }
            else {
                details.url = restaurantUrl;
                q.resolve(details);
            }
        });
    return q.promise;
}


function getRestaurantDetailsAsync(restaurant, callback) {
    console.log('Searching Yelp for ' + restaurant + ' ..');
    getRestaurantDetailsUrl(restaurant)
        .then(getRestaurantDetails)
        .then(details => {
            details.name = restaurant;
            callback(null, details);
        })
        .catch(err => {
            callback(err, restaurant);
        });
}

let YelpLoader = function() {
    this.details = [];
    this.failures = [];
};

YelpLoader.prototype.run = function(restaurants, forceRefresh) {
    this.details = [];
    this.failures = [];
    if (!forceRefresh) {
        let details = deserializeDetails(detailsDumpPath);
        if (details) {
            return Q.resolve(details);
        }
    }
    let deferred = Q.defer();
    let q = async.queue(getRestaurantDetailsAsync, concurrencyLimit);
    q.drain = () => {
        serializeDetails(detailsDumpPath, this.details);
        serializeFailures(failuresDumpPath, this.failures);
        deferred.resolve(this.details);
    };
    restaurants.forEach(restaurant =>
        q.push(restaurant, this.collectDetailsFromResult.bind(this))
    );
    return deferred.promise;
};

YelpLoader.prototype.collectDetailsFromResult = function(err, result) {
    const { details, failures } = this;
    if (err) {
        console.error(err);
        failures.push(result);
        return;
    }
    console.log('Pulled details of ' + result.name + '');
    details.push(result);
};

let instance = new YelpLoader();
Object.freeze(instance);
module.exports = instance;