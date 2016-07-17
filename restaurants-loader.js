let cheerio = require('cheerio');
let fs = require('fs');
let phantom = require('phantom');

function parseRestaurantsFromPage(pageHtml) {
    let restaurants = [];
    let $ = cheerio.load(pageHtml);
    $('.lic_restname').each((index, elem) => {
        restaurants.push($(elem).text());
    });
    return restaurants;
}

function getRestaurantNames(sourceUrl) {
    return new Promise((resolve, reject) => {
        let realInstance, realPage;
        phantom.create()
            .then(instance => {
                realInstance = instance;
                return instance.createPage();
            })
            .then(page => {
                realPage = page;
                return page.open(sourceUrl);
            })
            .then(status => {
                console.log(status);
                return realPage.property('content');
            })
            .then(content => {
                realPage.close();
                realInstance.exit();
                let restaurants = parseRestaurantsFromPage(content);
                restaurants.sort();
                resolve(restaurants);
            })
            .catch(error => {
                reject(error);
            });
    });
}

function saveRestaurantsToFile(filePath, restaurants) {
    fs.writeFile(filePath,
        restaurants.join('\n'),
        err => {
            if (err) {
                throw new Error(err);
            }
            console.log('Restaurants saved successfully..');
        });
}

function readRestaurantsFromFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8').split('\n');
    } catch (ex) {
        return undefined;
    }
}

let RestaurantLoader = function() {
    // this.sourceUrl = 'http://www1.toronto.ca/wps/portal/contentonly?vgnextoid=04deaf2c85006410VgnVCM10000071d60f89RCRD&view=tabList';
    this.sourceUrl = 'http://www1.toronto.ca/wps/portal/contentonly?vgnextoid=befeaf2c85006410VgnVCM10000071d60f89RCRD';
    this.dumpPath = './restaurants.dump';
};

RestaurantLoader.prototype.run = function(forceRefresh) {
    return new Promise((resolve, reject) => {
        if (!forceRefresh) {
            let restaurants = readRestaurantsFromFile(this.dumpDetailsPath);
            if (restaurants) {
                resolve(restaurants);
                return;
            }
        }
        getRestaurantNames(this.sourceUrl)
            .then(
                restaurants => {
                    saveRestaurantsToFile(this.dumpPath, restaurants);
                    resolve(restaurants);
                },
                err => {
                    reject(err);
                }
            );
    });
};

module.exports = new RestaurantLoader();
