// Loading Google Viz API Core Charts
google.load("visualization", "1", {packages:["corechart"]});

// Load up Google chart renderers for pivot table
$.pivotUtilities.renderers = $.extend($.pivotUtilities.renderers,
                                      $.pivotUtilities.gchart_renderers);

// Define the tour
tour = new Tour({
    steps: [
    {
        element: "#parking",
        title: "Step-1",
        content: 'The little blue things here represent columns from your CSV. Try dragging "Party" to the box called "Columns".'
    },
    {
        element: "#coldrop",
        title: "Step-2",
        content: 'You just grouped your data by "Party". Well done! Every blue "Label" here can be dragged around and put into different boxes.'
    },
    {
        element: "#parking",
        title: "Step-3",
        content: 'Lets try and put "Home State" into the "Rows" box and see what happens.'
    },
    {
        element: "#rowdrop",
        title: "Step-4",
        content: 'Now we are looking at your data grouped by party and home state. The outliers are red - Notice that no less than 6 Republican presidents hailed from Ohio!'
    },
    {
        element: "#charts",
        title: "Step-5",
        content: 'We can choose from a range of pretty charts to visualize our data. Try selecting "Stacked Bar Chart" from this dropdown menu.'
    },
    {
        element: "#parking",
        title: "Step-6",
        content: 'The labels that are dark blue can be clicked. Try click on "Took office [Month]". Uncheck all the months here except December.',
        reflex: true
    },
    {
        element: "#parking",
        title: "Step-7",
        content: 'Awesome work! Finally, if you want to share your dashboard on social media, copy/paste the URL of this page and you are done!',
        reflex: true
    },
]});

// Code for managing querystring
(window.onpopstate = function () {
    var query  = window.location.search.substring(1);
    queryStringDict = parseQueryString(query);
})();

// Parse query string - from stack overflow
function parseQueryString(queryString) {
    var urlParams;
    var match,
    pl = /\+/g,  // Regex for replacing addition symbol with a space
    search = /([^&=]+)=?([^&]*)/g,
    decode = function (s) {
        return decodeURIComponent(s.replace(pl, " "));
    },
    urlParams = {};
    while (match = search.exec(queryString))
       urlParams[decode(match[1])] = decode(match[2]);
  return urlParams
}

// trim all fields for objects in an Array
function mapper(objects) {
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return $.map(objects, function(obj, i) {
        var nobj = {};
        for(var key in obj) {
            var tkey = $.trim(key);
            var tval = $.trim(obj[key]);
            nobj[tkey] = (tval == NaN)? "": tval;
            if($.inArray(tkey, dateCols) != -1) {
                var date = new Date(Date.parse(obj[key]));
                nobj[tkey + ' [Year]'] = date.getFullYear();
                nobj[tkey + ' [Month]'] = months[date.getMonth()];
            }
        }
        return nobj;
    });
}

function getFilterVals(fields) {
    var query  = window.location.search.substring(1);
    var filters = parseQueryString(query);
    var filterVals = {}
    for(fi in fields) {
        var field = fields[fi];
        if((field in filters) && (filters[field].length > 0)) {
            filterVals[field] = {};
            var vals = filters[field].split(',');
            for(vi in vals) {
                var val = vals[vi];
                filterVals[field][val] = true;
            }
        }
    }
    return filterVals;
}

function filterRecord(rec, fVals) {
    for(field in rec) {
        if(field in fVals) {
            if(rec[field] in fVals[field]) {
                return true;
            }
        }
    }
    return false;
}

// tries to find classifiers amongst fields
function init_classifiers(data, fields) {
  // init classifiers
  classifiers = {};
  // in case of a querystring, we parse it to get the filter values
  var fvals = getFilterVals(fields);
  // iterate over data and load vals in classifier
  for(var di in data) {
    var rec = data[di];
    var filterRec = filterRecord(rec, fvals);
    // The purpose of the following was to do something with the
    // filters based on a selected filter - so for instance if
    // the user deselects England from the teams, it is logical
    // to not have England amongst the toss winners.
    if(filterRec) continue;

    for(field in rec) {
        var val = rec[field];
        if(!(field in classifiers)) classifiers[field] = {};
        classifiers[field][val] = true;
    }
  }
  // delete c that are not useful
  for(field in classifiers) {
    var len = Object.keys(field).length;
    if(len > (data.length/400)) {
        delete classifiers[fi];
    }
  }
}


$(function() {
  // Bind changes in controls to trigger updateVisualization
  $(".updateViz").change(function() {
    updateVisualization();
  });

  // Get data
  $.get(initData, function(data) {
    results = Papa.parse(data, {header: true, skipEmptyLines: true});
    results.meta.fields = $.map(results.meta.fields, function(v, i) {
        return $.trim(v);
    });
    results.data = mapper(results.data);
    dateCols = dateCols.filter(function(el) { return el != "" });
    for(i in dateCols) {
        results.meta.fields.push(dateCols[i] + " [Year]");
        results.meta.fields.push(dateCols[i] + " [Month]");
    }
    // try and get classifiers
    init_classifiers(results.data, results.meta.fields);
    // Init labels
    init_labels(results.meta.fields);
    init_functions();
    init_charts();
    // Loading visulaization as per QueryString
    if(jQuery.isEmptyObject(queryStringDict))
        updateVisualization();
    else updateVisFromQueryString(queryStringDict);
    // start tour
    tour.init(true);
    tour.start(true);

  });
});

// Labels are the little buttons that we drag and drop to operate the pivot
function init_labels(fields) {
    var source = $("#label-template").html();
    var template = Handlebars.compile(source);
    for (var i in fields) {
        var field = fields[i].trim();
        var label = "btn-info";
        var filter = null;
        if(field in classifiers) {
            label = "btn-primary";
            filter = 'onclick="showFilter(event)"';
            //var content = classifiers[field];
        }
        var context = {i: i, label: label, field: field, filter: filter};
        var html = template(context);
        $('#parking').append(html);
    }
}

// Initialize aggregation functions
function init_functions() {
  $.each(["Count", "Count Unique Values", "Sum", "Average", "Minimum", "Maximum"], function() {
      var funcString = this.toString();
      $("#functions").append($('<option></option>').attr("value", this).text(funcString));
  });
}

// Initialize chart types
function init_charts() {
  $.each(["Heatmap", "Line Chart", "Bar Chart", "Stacked Bar Chart", "Area Chart", "Scatter Chart"], function() {
    $("#charts").append($('<option></option>').attr("value", this).text(this));
  })
}

function flushAndReset() {
  $("#rowdrop").html('<div class="wrap"><span class="dotted">Drag items here.</span></div>');
  $("#coldrop").html('<div class="wrap"><span class="dotted">Drag items here.</span></div>');
  $("#valdrop").html('<div class="wrap"><span class="dotted">Drag items here.</span></div>');
  $("#parking").html('');
  // Reset Parking
  init_labels(results.meta.fields);
}

function updateVisFromQueryString(queryStrDict) {
  flushAndReset();
  $('#functions').val(queryStrDict.agg);
  $('#charts').val(queryStrDict.chart);
  var userColValues = queryStrDict.cols.split(',');
  var userRowValues = queryStrDict.rows.split(',');
  var userNumValues = queryStrDict.vals.split(',');
  adjustInitialDrag('parking', 'coldrop', userColValues);
  adjustInitialDrag('parking', 'rowdrop', userRowValues);
  adjustInitialDrag('parking', 'valdrop', userNumValues);
  for(var field in classifiers) {
    if(field in queryStringDict) {
        var fieldq = queryStringDict[field];
        if(fieldq.length > 0) {
            var vals = queryStrDict[field].split(',');
            for(var vi in vals) classifiers[field][vals[vi]] = false;
        }
    }
  }
  updateVisualization();
}

function getFiltersQuery() {
    var res = "";
    for(var field in classifiers) {
        var vals = classifiers[field];
        var temp = [];
        for(var val in vals) {
            var selected = vals[val];
            if(!selected) temp.push(val);
        }
        res += field + "=" + temp + "&";
    }
    return res;
}

function updateVisualization() {
    var rows = get_data("#rowdrop");
    var cols = get_data("#coldrop");
    var vals = get_data("#valdrop");
    var operation = $("#functions").val();
    var chartType = $("#charts").val();
    applyVisualization(rows, cols, vals, operation, chartType);
}

// Given the parameters, set up the dashboard
function applyVisualization(rows, cols, vals, agg, chart) {
    $("#table").pivot(results.data, {
        rows: rows,
        cols: cols,
        aggregator: $.pivotUtilities.aggregators[agg](vals),
        renderer: $.pivotUtilities.renderers[chart],
        filter: function(rec) {
            for(fi in classifiers) {
                var val = rec[fi];
                var res = classifiers[fi][val];
                if(!res) return res;
            }
            return true;
        }
    });
    $('#table > table').removeClass('pvtTable').addClass('table table-condensed table-bordered');
    $('#table > table > :first').wrap('<thead></thead>');
    $('#table > table > :gt(0)').wrap('<tbody></tbody>');
    // Set QueryString
    var queryString = '?rows=' + rows + '&cols=' + cols +
                      '&vals=' + vals + '&agg=' + agg +
                      '&chart=' + chart + "&" + getFiltersQuery();
    // set URL
    history.pushState({}, document.title, queryString);
}

function adjustInitialDrag(parent, target, fields) {
    // Function to populate fields in row and column div as per Querystring
    for(i in fields) {
        if(fields[i] != "") {
            var field = $("#" + parent).find('[data-value="' + fields[i] + '"]');
            appendLabel($("#" + target), field);
        }
    }
}

function get_data(drop) {
    return $(drop).children().map(function() {
        return $(this).attr('data-value')
    }).toArray();
}

function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("label", ev.target.id);
    var labels = $(ev.target).siblings("button");
}

function drop(ev) {
    ev.preventDefault();
    var data = ev.dataTransfer.getData("label");
    var label = document.getElementById(data);
    var target = ev.target.closest(".drop");
    appendLabel(target, label);
    updateVisualization();
}

function appendLabel(target, label) {
    var labels = $(target).children("button");
    if(labels.length == 0)
        $(target).empty();
    $(target).append(label);
}

function updateFilter(el) {
    var cb = $(el);
    var field = cb.attr("name");
    var value = cb.attr("value");
    classifiers[field][value] = !classifiers[field][value];
    //window.location.search += "&" + getFilterQuerystring()
    updateVisualization();
}

function showPopover(el) {
    var cb = $(el);
    var pop = $(".popover:visible");
    if(pop.length) {
        cb.popover("destroy");
        return;
    }
    var field = cb.attr("data-value");
    var source = $("#popover-template").html();
    var template = Handlebars.compile(source);
    var content = template({classifiers: classifiers[field], field: field});
    $(cb).popover({
        html: true,
        container: "body",
        title: field,
        content: content,
        trigger: "click"
    });
    $(cb).popover("show");
}
