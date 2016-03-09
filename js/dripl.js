// Loading Google Viz API Core Charts
google.load("visualization", "1", {packages:["corechart"]});

// Load up Google chart renderers
$.pivotUtilities.renderers = $.extend($.pivotUtilities.renderers,
                                      $.pivotUtilities.gchart_renderers);

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
            nobj[tkey] = $.trim(obj[key]);
            if($.inArray(tkey, dateCols) != -1) {
                var date = new Date(Date.parse(obj[key]));
                nobj[tkey + ' [Year]'] = date.getFullYear();
                nobj[tkey + ' [Month]'] = months[date.getMonth()];
            }
        }
        return nobj;
    });
}

// tries to find classifiers amongst fields
function getClassifiers(data, fields) {
  var classifiers = {};
  for(var k in fields) {
    var field = fields[k];
    var ucol = $.unique(
      $.map(data, function(val, i) {
        return val[field];
      })
    );
    if(ucol.length < data.length/2 & ucol.length > 1) {
        var temp = [];
        for(ui in ucol) {
            temp.push({
                'value': ucol[ui],
                'selected': true
            });
        }
        classifiers[field.trim()] = temp;
    }
  }
  return classifiers
}


$(function() {
  // Bind changes in controls to trigger updateVisualization
  $(".updateViz").change(function() {
    updateVisualization();
  });

  // Get data
  $.get(initData, function(data) {
    results = Papa.parse(data, {header: true});
    results.meta.fields = $.map(results.meta.fields, function(v, i) {
        return $.trim(v);
    });
    results.data = mapper(results.data);
    for(i in dateCols) {
        results.meta.fields.push(dateCols[i] + " [Year]");
        results.meta.fields.push(dateCols[i] + " [Month]");
    }
    // try and get classifiers
    classifiers = getClassifiers(results.data, results.meta.fields);
    // Init labels
    init_labels(results.meta.fields);
    init_functions();
    init_charts();
    // Loading visulaization as per QueryString
    if (jQuery.isEmptyObject(queryStringDict))
        updateVisualization();
    else
    updateVisFromQueryString(queryStringDict);
  });
});

// Labels are the little buttons that we drag and drop to operate the pivot
function init_labels(fields) {
    var source = $("#label-template").html();
    var template = Handlebars.compile(source);
    for (var i in fields) {
        var field = fields[i].trim();
        var label = "btn-primary";
        var filter = null;
        if(classifiers[field]) {
            label = "btn-danger";
            filter = 'onclick="showFilter(event)"';
            var content = classifiers[field];
        }
        var context = {i: i, label: label, field: field, filter: filter, classifiers: classifiers[field]};
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
  for(fld in classifiers) {
    var cla = classifiers[fld];
    var vals = queryStrDict[fld].split(',');
    for(i in cla) {
        if($.inArray(cla[i].value, vals) != -1) {
            cla[i].selected = false;
        }
    }
  }
  updateVisualization();
}

function showFilter(ev) {
  console.log($(ev.target).attr("data-value"));
}

function getFiltersQuery() {
    var res = "";
    for(fld in classifiers) {
        var tmp = $.grep(classifiers[fld], function(v, i) {return !v.selected});
        res += fld + "=" + $.map(tmp, function(v, i) {return v.value}) + "&";
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
            for(f in classifiers) {
                cla = classifiers[f];
                for(i in cla) {
                    if(!cla[i].selected && (rec[f] == cla[i].value)) {
                        return false;
                    }
                }
            }
            return true;
        }
    });
    $('#table > table').removeClass('pvtTable').addClass('table');
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
    if(labels.length == 0) {
        $(ev.target).after('<div class="wrap"><span class="dotted">Drag items here.</span></div>');
    }
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
    var result = $.grep(classifiers[field], function(e){
        return e.value == value; });
    result[0].selected = !result[0].selected;
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
        trigger: "click focus"
    });
    $(cb).popover("show");
}
