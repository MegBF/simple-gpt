/**
* SimpleGPT: A GPT framework designed for optimal ease of use and debugging. 
* Contains inview (lazyloading) functionality. 
* Works with video preroll ads and companion ads. 
* Designed to work with multiple request asynchronous ads.
*
* @requires jQuery-1.10.2.js
*/
/*global window */

/** init function
* @param pageTargeting {object} - key-value pairs for page-level targeting (all ads on page will contain these pairs)
* @param zone {string} - the DFP ad zone. Format should be '/* /* /* //* // *' etc.
*    - first three slashes are single slashes. All that follow are double. Beginning slash, but no trailing slash.
*
*/

/* create adSlot object for header ad, which is universal for all pages */
$(window).one("gpt-header-ready", function () {
    var simpleGPT = window.simpleGPT || {};
    simpleGPT.adSlots = window.simpleGPT.adSlots || {};
    var sizeSet = window.deviceType == "Tablet" ? "[[728, 90], [320, 50]]" : "[[970, 90], [728, 90], [320, 50]]",
			sizeMapping = window.deviceType == "Tablet" ? "[728, 90]" : "[[728, 90],[970, 90]]";
    // console.log('sizeSet is ' + sizeSet + ' and mapping is ' + sizeMapping);
    simpleGPT.adSlots.gptAd1 = {
        sizeSet: sizeSet,
        companion: false,
        mapping: "googletag.sizeMapping().addSize([728, 120], " + sizeMapping + ").addSize([320, 100], [320, 50]).build();",
        slotTargeting: {
            pos: "top"
        }
    }
    $(window).trigger("gpt-ready");
});



$(window).one("gpt-constructor-ready", function () {
    simpleGPT = new simpleGPTConstructor({
        "ugc": WTE.AdParams.ugc,
        "page": WTE.AdParams.page,
        "plt": WTE.AdParams.plt,
        "mdv": WTE.AdParams.mdv
    }, WTE.AdParams.zone);


});



(function (w, $) {
    "use strict";

    w.simpleGPTConstructor = function (config) {
        var self = this;

        self.pageTargeting = JSON.parse(JSON.stringify(config.pageTargeting));
        self.totalAds = "auto"; // limits the number of ads on the page if the ?total_ads parameter is used
        self.companion = false; // flag to indicate whether or not a companion ad will be loaded. If so, init() will load extra services.
        self.windowHeight = 0;
        self.isGptLoaded = false; // Changes to true if loadGptScript() is successful.
        self.zone = config.zone;
        self.adRequest = ""; // Contains the entire ad request before enableServices(). Gets logged in the console when?gptdebug is used.
        self.testAd();
		self.inview = config.inview;
        self.loadGptScript();
        self.ref = function () { return this; }
		self.adSlots = config.ads;
    }

    simpleGPTConstructor.prototype = {

        /*
        * addTargeting cycles through an object's key-value pairs and returns the values in GPT's setTargeting format
        * @param {type} valid values are "page" (affects all ads) and "slot" (affects a single ad)
        * @param {params} object
        * @returns string
        * @example return string: 'googletag().pubads().setTargeting('key', 'value').setTargeting('key', ['value1', value2', value3'])'
        */


        addTargeting: function (type, params) {
            var self = this,
            targeting = "";
            if (type == "page") {
                targeting += "googletag.pubads()";
            }
            for (var key in params) {
                if (typeof (params[key]) != "object" || (typeof (params[key]) != "object" && params[key].length == 1)) {
                    targeting += ".setTargeting('" + key + "', '" + params[key] + "')";
                }
                else {
                    targeting += ".setTargeting('" + key + "', ['";
                    for (var i = 0; i < params[key].length; i++) {
                        targeting += params[key][i];
                        if (i != params[key].length - 1) {
                            targeting += "', '"
                        };
                    };
                    targeting += "'])";
                }
            }
            return targeting;
        },

        testAd: function () {

            var self = this;
            if (window.location.href.indexOf("no_ads") !== -1) {
                this.totalAds = 0;
                return;
            }
            if (window.location.href.indexOf("total_ads") !== -1) {
                var stringPos = window.location.href.indexOf("total_ads") + 10;
                var adNumber = window.location.href.substr(stringPos, stringPos + 2);
                self.totalAds = parseInt(adNumber);
            }

        },
        /**
        * loads GPT script and GPT proxy script (required for mobile GPT use)
        */
        loadGptScript: function () {
            var self = this;
            $.getScript('http://s0.2mdn.net/instream/html5/gpt_proxy.js', function (script, textStatus) {
                if (textStatus === 'success') {
                    self.isProxyLoaded = true;
                    self.message('GPT proxy loaded successfully');
                } else {
                    self.isProxyLoaded = false;
                    console.log('GPT proxy not loaded successfully. Ads may not work properly on mobile devices.');
                }
            }).done(function () {
                $.getScript('http://www.googletagservices.com/tag/js/gpt.js', function (script, textStatus) {
                    if (textStatus === 'success') {
                        self.isGptLoaded = true;
                        self.message('gpt script was loaded successfully!');
                    } else {
                        self.isGptLoaded = false;
                        console.log('gpt script was not loaded successfully.');
                    }
                }).done(function () {
                    if (self.initSuccess == false ) {
						self.init();
                        
                    }
                });
            });
        },


        /* lazyDisplayThisAd - if the ad is in view, load it. If not, set a scroll event that will check to see when it is in view, and then load it.
        */
        lazyDisplayThisAd: function (self, ad) {

            function isElementInViewport(el) {

                //special bonus for those using jQuery
                if (typeof jQuery === "function" && el instanceof jQuery) {
                    el = el[0];
                }

                var rect = el.getBoundingClientRect();

                return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && /*or $(window).height() */
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) /*or $(window).width() */
    );
            }

            var adIsInView = isElementInViewport(document.querySelector("#" + ad.id));
            // var adIsInView = ElementInViewport($("#" + ad.id));
            if (adIsInView != undefined) {
                self.message(ad.id + ' is in view!');
                self.displayAd(ad);
            }
            else if ($("#" + ad.id).length) {
                if (ad.number <= self.totalAds) {
                    self.message("setting a scroll event for ad " + ad.id);
                    $(document).on("scroll." + ad.id, function () {
                        self.message("scroll." + ad.id);
                        adIsInView = $("#" + ad.id + ":in-viewport")[0];
                        // if the ad is in view, load it
                        if (adIsInView != undefined) {
                            self.displayAd(ad);
                        }
                    });
                }
                else {
                    self.message(ad.id + ' exceeds total_ads and was not loaded');
                }
            }
            else {
                console.log('error: <div id="' + ad.id + '"> does not exist on the page. Ad not loaded.');
            }
        },

        count: function (params) {
            var length = 0;
            for (var key in params) {
                length++;
                params[key]["number"] = length;
            }
            return length;
        },
        addProperties: function (adSlots) {
            var self = this;
            for (var ad in adSlots) {
                self.adSlots[ad]["id"] = ad;
                self.adSlots[ad]["loaded"] = false;
            }
        },
        removeDisabledAds: function (adSlots) {
            var self = this;
            for (var ad in adSlots) {
                if (adSlots[ad]["disabled"] == true) {
                    self.message(ad + ' is disabled and will not load. It has been deleted from simpleGPT.adSlots');
                    delete adSlots[ad];
                }
            }
        },

        checkZone: function (zone) {
            var self = this;
            var endOfZone = zone.split('/')[3];
            if (endOfZone.length == 0) {
                console.log('GPT ERROR: Improperly formatted ad zone. Ads will not load.');
                return false;
            }
            else {
                self.message('GPT Zone: ' + zone);
                return true;
            }
        },

        init: function (timer) {
			var self = this;
			if (self.isGptLoaded == true) { 
				self.initSuccess = true;
				if (self.checkZone(self.zone) == true) {
					self.addProperties(self.adSlots);
					self.removeDisabledAds(self.adSlots);
					var numberOfAds = self.count(self.adSlots);
					// if self.totalAds is set to "auto" display all ads in the simpleGPT.adSlots object.
					if (self.totalAds == "auto") {
						self.totalAds = numberOfAds;
					}

					var adRequest = "googletag.cmd.push(function() {";

					for (var ad in self.adSlots) {
						adRequest += self.declareAd(self.adSlots[ad]);
					};
					adRequest += self.addTargeting("page", self.pageTargeting) + ";\ngoogletag.companionAds().setRefreshUnfilledSlots(true);\ngoogletag.pubads().enableVideoAds();\ngoogletag.pubads().enableAsyncRendering();\ngoogletag.pubads()";
					if (self.categoryExclusion) {
						
						".setCategoryExclusion('" + "')"
					}
					adRequest += ";\n";
					adRequest += "googletag.enableServices(); });";
					self.adRequest = adRequest;

					var declareAd = new Function(adRequest);
					self.message(adRequest);
					declareAd();
					if (timer != 0) {
						for (var ad in self.adSlots) {
							if (self.inview == true) {
								self.lazyDisplayThisAd(self, self.adSlots[ad]);
							}
							else if (self.inview == false) {
								self.displayAd(self.adSlots[ad]);
							}
							else {
								self.message('simpleGPT.inview is not set correctly. The ad will load immediately.');
								self.displayAd(self.adSlots[ad]);
							}
						}
					}
					else {
						for (var ad in self.adSlots) {
							self.displayAd(self.adSlots[ad]);
						}

					}
				}
			}
			else {
			self.initSuccess = false;
			}
			
        },

        declareAd: function (ad) {
            var self = this,
            adRequest = "",
	            mapping = ad.mapping,
	            sizeSet = ad.sizeSet,
	            id = ad.id,
                slot = ad.slot,
	            slotTargeting = ad.slotTargeting,
				skinAd = ad.skinAd,
                categoryExclusion = "";
            if (ad.categoryExclusion) { categoryExclusion = ".setCategoryExclusion('" + ad.categoryExclusion + "')"; }
            var adNumber = id.replace(/\D/g, '');
            if (ad.loaded == false && $("#" + ad.id).length && adNumber <= self.totalAds) {
                if (ad.companion == false) {
                    if (ad.skinAd.toString().toLowerCase() == "true")
                        adRequest += "\n\n" + id + " = googletag.defineOutOfPageSlot('" + self.zone + "', '" + id + "')\n" + self.addTargeting("slot", slotTargeting) + ".addService(googletag.pubads());\n";
                    else
                        adRequest += "\n\n" + id + " = googletag.defineSlot('" + self.zone + "', " + sizeSet + ", '" + id + "')\n" + categoryExclusion + self.addTargeting("slot", slotTargeting) + ";\nvar " + id + "mapping = " + mapping + "\n" + id + ".defineSizeMapping(" + id + "mapping).addService(googletag.pubads());\n";
                }
                else {
                    self.companion = true; // sets a flag so that init() will include the companionAds service
                    adRequest += "\n\n" + id + " = googletag.defineSlot('" + self.zone + "', " + sizeSet + ", '" + id + "')\n" + self.addTargeting("slot", slotTargeting) + ";";
                    adRequest += "\nvar " + id + "mapping = " + mapping + "\n";
                    adRequest += id + ".defineSizeMapping(" + id + "mapping)";
                    adRequest += ".addService(googletag.companionAds()).addService(googletag.pubads());\n\n";
                }
                return adRequest;

            }
            else {
                return "";
            }
        },

        displayAd: function (ad) {
            var self = this,
            adRequest = "",
            displayAd,
            adNumber = ad.number;
            if (adNumber <= self.totalAds) {
                //                $("#" + ad.id).addClass("gpt-loaded");
                adRequest += "googletag.cmd.push(function() { googletag.display('" + ad.id + "'); });";
                displayAd = new Function(adRequest);
                self.message(adRequest);
                displayAd();
                // flag slot as loaded
                self.adSlots[ad.id].loaded = true;
                // remove lazy scrolling
                $(document).off('scroll.' + ad.id);
                // the gpt-ad-loaded event resets the timeout function in setAdServerTimeout
                $(w).trigger("gpt-ad-loaded", "#" + ad.id);
                return adRequest;
            }
        },


        displayLabel: function (x) {
            $("#" + x).addClass("visible gpt-loaded");
        },
		
        // ADD A CREATE CALLBACK FUNCTION
		// ADD IT NOW
		// !!!
		
        /* grab the ad call url and insert it into a div overlaying the ad when the ?gptdebug parameter is used
        * @param {string} adId
        *
        */
        debugAdCode: function (adId) {
            if (window.location.href.indexOf("debugadcode") > -1) {
                var x = googletag.service_manager_instance.a.publisher_ads.L;
                for (var i in x) {
                    if (x[i].b.d == adId) {
                        var adCall = x[i].s,
                        adPos = $("#" + adId).offset();
                        if (window.deviceType != "Mobile") {
                            $("#" + adId).prepend("'<div id='" + adId + "-debug' class='gpt-ad-debug'><h4>" + adId + "Call:</h4><textarea>" + adCall + "</textarea></div>");
                        }
                        console.log(adId + ' ad call is ' + adCall);
                        return;
                    }
                }
            }
        },
        message: function (msg) {
            if (window.location.href.indexOf("gptdebug") > -1) {
                console.info(msg);
            }
        }

    };

})(window, jQuery); 