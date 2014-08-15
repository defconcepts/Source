/*
*
* @author Robert Haritonov (http://rhr.me)
*
* */

define([
    'jquery',
    'sourceModules/module',
    'sourceModules/utils',
    'sourceModules/parseFileTree'
    ], function($, module, utils, parseFileTree) {

        var defaults = {
        "filterEnabled": true,
        "showPreviews": false,
        "sortType": 'sortByDate',
        "sortDirection":"forward",
        "pageLimit": 999,
        "ignorePages": [],
        "thumbnailName": 'thumbnail.png',
        "classes": {
            CATALOG: 'source_catalog',
            CATALOG_LIST: 'source_catalog_list',
            CATALOG_LIST_I: 'source_catalog_list_i',
            CATALOG_LIST_ALL: 'source_catalog_all',
            CATALOG_LIST_ALL_A: 'source_a_bl',
            CATALOG_IMG_TUMBLER: 'source_catalog_image-tumbler',
            CATALOG_LIST_A: 'source_catalog_a source_a_g',
            CATALOG_LIST_A_IMG: 'source_catalog_img',
            CATALOG_LIST_A_TX: 'source_catalog_title',
            CATALOG_LIST_DATE: 'source_catalog_footer',
            CATALOG_LIST_BUBBLES: 'source_bubble',
            CATALOG_FILTER : 'source_catalog-filter',
            SOURCE_SUBHEAD : 'source_subhead'
        },
        "labels": {
            RES_LINK_TO_ALL : 'All',
            RES_AUTHOR : 'Author',
            RES_NO_DATA_ATTR : 'Data-nav attr not set',
            RES_NO_CATALOG : 'Specified catalog is empty or does not exist',
            RES_NO_CATALOG_INFO : 'Specified catalog does not have data about it'
        }
    };

    function GlobalNav() {
        var _this = this;
        this.options.modulesOptions.globalNav = $.extend(true,
            defaults,
            this.options.modulesOptions.globalNav,
            JSON.parse(localStorage.getItem('source_enabledFilter')) || {}
        );
        $(function(){
            _this.init();
        });
    }

    GlobalNav.prototype = module.createInstance();
    GlobalNav.prototype.constructor = GlobalNav;

    GlobalNav.prototype.init = function () {
        var navOptions = this.options.modulesOptions.globalNav;
        this.catalog = $("." + navOptions.classes.CATALOG);
        this.drawNavigation();

        if (this.options.modulesOptions.globalNav.filterEnabled) {
            this.initCatalogFilter();
        }
    };


    // Filtering by specified catalogue
    var skipSpec = function(navListCat, currentObj) {
        var obj = currentObj;
        var response = true; // skip by default

        // obj['cat'] is an array; if cat has needed value
        if (!!obj['cat'] && obj['cat'].indexOf(navListCat) > -1) {
            response = false;

        // without-cat mode, showing all specs without cat field in info.json defined or
        } else if ( navListCat === 'without-cat' && (typeof obj['cat'] === 'undefined' || obj['cat'].length === 0) ) {
            response = false;
        }
        return response;
    };

    // Filtering hidden specs
    var isHidden = function(currentObj) {
        var obj = currentObj;
        var response = false; // skip by default

        // obj['cat'] is an array
        if (!!obj['cat'] && obj['cat'].indexOf("hidden") > -1 ) {
            response = true;
        }
        return response;
    };

    GlobalNav.prototype.initCatalog = function(catalog, catalogMeta, specifCatAndDirDefined) {
        var classes = this.options.modulesOptions.globalNav.classes;
        if (catalog.find('.' + classes.CATALOG_LIST).length === 0) {
            catalog.append([
                '<ul class="', classes.CATALOG_LIST, '">',
                    '<img src="/source/assets/i/process.gif" alt="Загрузка..."/>',
                '</ul>'
            ].join(''));
        }
        if (!specifCatAndDirDefined && catalogMeta) {
            var isHeaderAdded = catalog.find('.' + classes.CATALOG_LIST_A_TX).length !== 0;
            var isInfoAdded = catalog.find('.source_catalog_tx').length !== 0;



            if (catalogMeta && !isHeaderAdded) {
                catalog.prepend(['<h2 class="', classes.CATALOG_LIST_A_TX, '">', catalogMeta.title,'</h2>'].join(''));
            }
            if (catalogMeta.info && $.trim(catalogMeta.info) !== '' && !isInfoAdded) {
                sourceCatalog
                    .children('.' + classes.CATALOG_LIST_A_TX)
                    .first()
                    .after('<div class="source_catalog_tx">' + catalogMeta.info + '</div>');
            }
        } else {
            console.log(this.options.modulesOptions.globalNav.labels.RES_NO_CATALOG_INFO);
        }
    };

    // Drawing navigation and page info in each catalog defined on page
    GlobalNav.prototype.drawNavigation = function (sortType, sortDirection) {
        var _this = this;
        var navOptions = this.options.modulesOptions.globalNav;
        var classes = navOptions.classes;
        var labels = navOptions.labels;
        var sortType = sortType || navOptions.sortType;
        var sortDirection = sortDirection || navOptions.sortDirection;

        this.catalog.each(function () {
            var catalog = $(this);
            var navListDir = catalog.attr('data-nav');
            var navListCat = catalog.attr('data-cat');

            // Catalog has no data about category
            var targetCatalog = parseFileTree.getCurrentCatalogSpec(navListDir);
            _this.initCatalog(catalog, targetCatalog, !!navListDir && !!navListCat);

            // TODO: check if its valid
            if (navListDir && !navListDir.length) {
                // Display error
                catalog.find('.' + classes.CATALOG_LIST).html(labels.RES_NO_DATA_ATTR);
                return;
            }

            var targetData = parseFileTree.getCatalog(navListDir, _this.getSortCondition(sortType, sortDirection));
            _this.renderNavigationList(catalog, targetData);
        });
    };

    GlobalNav.prototype.renderNavigationList = function(catalog, data) {
        var navOptions = this.options.modulesOptions.globalNav;
        var target = catalog.find('.' + navOptions.classes.CATALOG_LIST);
        var navListDir = catalog.attr('data-nav');
        var navListCat = catalog.attr('data-cat');

        var filter = function(spec) {
            var isInIgnoreList = !spec || !spec.title || !!~$.inArray(spec.title, navOptions.ignorePages);
            var isFiltered = !!navListDir && !!navListCat && skipSpec(navListCat, spec) || isHidden(spec);
            return isInIgnoreList || isFiltered ? false : true;
        };

        if(target && target.length === 1 && data && data.length) {
            var itemsDocFragment = this.getNavigationItemsList(data, navListDir, filter);
            target.html(itemsDocFragment);
        }
    };

    GlobalNav.prototype.getNavigationItemsList = function(specifications, catalogUrl, isValid) {
        // temporary container to hold navigation items.
        var navigationItemsList = document.createDocumentFragment();
        var navOptions = this.options.modulesOptions.globalNav;
        var pageLimit = navOptions.pageLimit;
        var classes = navOptions.classes;
        var labels = navOptions.labels;
        var lengthLimit = pageLimit > specifications.length
            ? specifications.length
            : pageLimit;
        for (var j = 0; j < lengthLimit; j++) {
            var spec = specifications[j]['specFile'];
            if (!isValid(spec)) {
                continue;
            }
            navigationItemsList.appendChild(this.createNavTreeItem(spec).get(0));
        }

        // Go to cat page link
        if (specifications.length > lengthLimit) {
            navigationItemsList.appendChild($([
                '<li class="', classes.CATALOG_LIST_I, ' ', classes.CATALOG_LIST_ALL, '">',
                    '<a class="', classes.CATALOG_LIST_ALL_A, '" href="', catalogUrl, '">', labels.RES_LINK_TO_ALL, ' ', specifications.length, '</a>',
                '</li>'].join('')).get(0)
            );
        }
        return navigationItemsList;
    };

    GlobalNav.prototype.createNavTreeItem = function(target) {
        if (!target) return;
        var navConfig = this.options.modulesOptions.globalNav;
        var classes = navConfig.classes;
        var author = target.author
            ? " | " + navConfig.RES_AUTHOR + ": " + target.author
            : "";

        // fixing relative path due to server settings
        var targetUrl = target.url.charAt(0) === '/' ? target.url : '/' + target.url;
        var imageUrl = targetUrl + '/' + navConfig.thumbnailName;

        if (!this.createNavTreeItem.template) {
            this.createNavTreeItem.template = $([
                '<li class="', classes.CATALOG_LIST_I, '">',
                    '<a class="', classes.CATALOG_LIST_A, '" href="#">',
                        '<img class="', classes.CATALOG_LIST_A_IMG,'" />',
                        '<span class="', classes.CATALOG_LIST_A_TX,'"></span>',
                        '<div class="', classes.CATALOG_LIST_DATE,'"></div>',
                        '<div class="', classes.CATALOG_LIST_BUBBLES,'"></div>',
                    '</a>',
                '</li>'
            ].join(''));
        }
        var result = this.createNavTreeItem.template.clone(true);
        result.find("." + classes.CATALOG_LIST_A.split(' ').join('.')).attr("href", targetUrl);
        result.find("." + classes.CATALOG_LIST_A_IMG)
            .attr("src", imageUrl)
            .error(function(e) {
                $(this).remove();
            });
        result.find("." + classes.CATALOG_LIST_A_TX).html(target.title);
        result.find("." + classes.CATALOG_LIST_DATE).html(target.lastmod + author);
        if(parseInt(target.bubbles)) {
            result.find("." + classes.CATALOG_LIST_BUBBLES).html(target.bubbles);
        }

        return result;
    };

    GlobalNav.prototype.initCatalogFilter = function() {
        var navOptions = this.options.modulesOptions.globalNav;

        var $subhead = $('.' + navOptions.classes.SOURCE_SUBHEAD),
            $filter = $('.' + navOptions.classes.CATALOG_FILTER),
            $catalog = $('.' + navOptions.classes.CATALOG);

        if (!$subhead.length || !$catalog.length) return;

        if (!$filter.length) {
            $subhead.prepend('<div class="' + navOptions.classes.CATALOG_FILTER + '"></div>');
        }

        this.drawSortFilters();
        this.drawToggler();
    };

    GlobalNav.prototype.drawToggler = function() {
        var CATALOG = this.options.modulesOptions.globalNav.classes.CATALOG,
            CATALOG_IMG_TUMBLER = this.options.modulesOptions.globalNav.classes.CATALOG_IMG_TUMBLER,
            CATALOG_FILTER = this.options.modulesOptions.globalNav.classes.CATALOG_FILTER,
            showPreviews = this.options.modulesOptions.globalNav.previews,

            initPreviewValue = localStorage.getItem( 'source_showPreviews') || showPreviews,
            $catalog = $('.' + CATALOG),
            $filter = $('.' + CATALOG_FILTER);

        if (initPreviewValue == 'true') { // initPreviewValue is string, not boolean
            $catalog.addClass('__show-preview');
            $filter.append('<a class="' + CATALOG_IMG_TUMBLER + '" href="#">Скрыть превьюшки</a>');
        } else {
            $filter.append('<a class="' + CATALOG_IMG_TUMBLER + '" href="#">Показать превьюшки</a>');
        }

        $(document).on('click', '.' + CATALOG_IMG_TUMBLER, function(e) {
            e.preventDefault();
            var showPreviews = localStorage.getItem( 'source_showPreviews');

            var $this = $(this),
                previewText;

            if (showPreviews == 'true') { // string
                previewText = 'Показать превьюшки';
                localStorage.setItem('source_showPreviews' , false);
            } else {
                previewText = 'Скрыть превьюшки';
                localStorage.setItem('source_showPreviews', true);
            }

            $this.text(previewText);
            $catalog.toggleClass('__show-preview');
        });
    };

    GlobalNav.prototype.drawSortFilters = function() {
        var CATALOG_FILTER_CLASS = this.options.modulesOptions.globalNav.classes.CATALOG_FILTER,
            defaultSort = this.options.modulesOptions.globalNav.sortType,

            $filterWrapper = $('.' + CATALOG_FILTER_CLASS),
            enabledFilter = JSON.parse(localStorage.getItem('source_enabledFilter')) || {"sortType":defaultSort,"sortDirection":"forward"},

            nav = '<ul class="source_sort-list">' +
                '<li class="source_sort-list_li">Sort by&nbsp;</li>' +
                '<li class="source_sort-list_li"><a class="source_sort-list_a" id="sortByAlph" href="#sort=alph">alphabet</a></li>' +
                '<li class="source_sort-list_li">&nbsp;or&nbsp;</li>' +
                '<li class="source_sort-list_li"><a class="source_sort-list_a" id="sortByDate" href="#sort=date">date</a></li>' +
                '</ul>',
            _this = this;

        $filterWrapper.append(nav);

        var $activeFilter = $('#' + enabledFilter.sortType);
        $activeFilter.parent().addClass('__active');

        if (enabledFilter.sortDirection == 'forward') {
            $activeFilter.parent().addClass('__forward');
        }

        var updateLocalStorage = function(obj) {
            localStorage.setItem('source_enabledFilter', JSON.stringify(obj));
        };

        var updateEnabledStatusObject = function(sortType, sortDirection) {
            enabledFilter.sortType = sortType;
            enabledFilter.sortDirection = sortDirection;
        };

        var updateView = function(el) {
            var $this = el;

            $('.source_sort-list_li').removeClass('__active');
            $this.parent()
                .addClass('__active')
                .toggleClass('__forward');

            var sortType = $this.attr('id'),
                sortDirection = 'backward';

            if ( $this.parent().hasClass('__forward') ) {
                sortDirection = 'forward';
            }

            updateEnabledStatusObject(sortType, sortDirection);
            updateLocalStorage(enabledFilter);
            _this.drawNavigation(sortType, sortDirection)
        }

        $(document).on('click', '#sortByAlph', function() {
            updateView($(this));
        });

        $(document).on('click', '#sortByDate', function() {
            updateView($(this));
        });
    };

    GlobalNav.prototype.getSortCondition = function(type, direction) {
        var multiplexer = direction === "forward" ? 1 : -1;
        if (type === "sortByAlph") {
            return function sortByAlph(a, b) {
                if (!a['specFile'].title || !b['specFile'].title) return 0;
                a = a['specFile'].title.replace(/(^\s+|\s+$)/g,'');
                b = b['specFile'].title.replace(/(^\s+|\s+$)/g,'');

                if (a === b) return 0;
                return multiplexer * ((a > b) ? 1 : -1);

            };
        }
        // type === "sortByDate", this is default one
        return function sortByDate(a, b) {
            a = parseInt(a['specFile'].lastmodSec);
            b = parseInt(b['specFile'].lastmodSec);
            if(a === b) return 0;
            return multiplexer * ((a > b) ? -1 : 1);
        };
    };

    return new GlobalNav();
});
