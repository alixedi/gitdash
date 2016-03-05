// Loading Google Viz API Core Charts
google.load("visualization", "1", {packages:["corechart"]});

$.pivotUtilities.renderers = $.extend($.pivotUtilities.renderers,
                                      $.pivotUtilities.gchart_renderers);

/*
renderers = $.extend($.pivotUtilities.renderers,
                     $.pivotUtilities.gchart_renderers,
                     {"Geo Chart": makeGoogleChart("GeoChart", {
                        region: mapRegion,
                        displayMode: "markers",
                        colorAxis: {colors: ["orange", "red"]}})});
*/

// Code for managing querystring
(window.onpopstate = function () {
  var query  = window.location.search.substring(1);
  queryStringDict = parseQueryString(query);
})();

//queryStringDict = urlParams;
function parseQueryString(queryString) {
  var urlParams;
  var match,
      pl     = /\+/g,  // Regex for replacing addition symbol with a space
      search = /([^&=]+)=?([^&]*)/g,
      decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
    urlParams = {};
    while (match = search.exec(queryString))
       urlParams[decode(match[1])] = decode(match[2]);
  return urlParams
}

// trim all fields for objects in an Array
function trimAll(objects) {
  return $.map(objects, function(obj, i) {
    for(key in obj)
      obj[key] = $.trim(obj[key]);
    return obj;
  });
}


// tries to find classifiers amongst fields
function getClassifiers(data, fields) {
  var classifiers = {};
  for(var k in fields) {
    var field = fields[k]
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
      classifiers[field] = temp;
    }
  }
  return classifiers
}


$(function() {
  // Bind Change in controls to trigger updateVisualization
  $(".updateViz").change(function() {
    updateVisualization();
  });

  // Bind favorites
  //$(".favorites").click(function(e) {
  //  selectFavorite(e.target);
  //});

  // Get data
  $.get(initData, function(data) {
    results = Papa.parse(data, {header: true});
    results.data = trimAll(results.data)
    // try and get classifiers
    classifiers = getClassifiers(results.data, results.meta.fields);
    // Init labels
    init_labels(results.meta.fields);
    init_functions();
    init_charts();
    // Loading visulaization as per QueryString
    if (jQuery.isEmptyObject(queryStringDict)) {
        $("#table").pivot(results.data);
        //selectFavorite(".favorites:first");
        }
    else {
        updateVisFromQueryString(queryStringDict);
        $.each($(".favorites"), function() {
          var dataLink = this.getAttribute('data-link');
          var queryStr = dataLink.slice(dataLink.lastIndexOf("/") + 2);
          var query  = window.location.search.substring(1);
          if(queryStr === query) {
            selectFavorite($(this));
          }
        });
        }
    //$('select').selectpicker();
  });
});

function selectFavorite(fav) {
  $(fav).addClass('active'); // activated tab
  $(fav).siblings().removeClass('active'); // previous tab
  var dataLink = $(fav).attr('data-link');
  var queryStr = dataLink.slice(dataLink.lastIndexOf("/") + 2);
  var queryDict = parseQueryString(queryStr);
  updateVisFromQueryString(queryDict);
}

function flushAndReset() {
  // Flush
  $("#rowdrop").empty();
  $("#coldrop").empty();
  $("#valdrop").empty();
  $("#parking").empty();

  // Reset Parking
  init_labels(results.meta.fields);
}

function updateVisFromQueryString(queryStrDict) {
  flushAndReset();
  $('#functions').val(queryStrDict.opt);
  $('#charts').val(queryStrDict.chartType);
  var userColValues = queryStrDict.cols.split(',');
  var userRowValues = queryStrDict.rows.split(',');
  var userNumValues = queryStrDict.optVal.split(',');
  adjustInitialDrag('parking','coldrop',userColValues);
  adjustInitialDrag('parking','rowdrop',userRowValues);
  adjustInitialDrag('parking','valdrop',userNumValues);
  updateVisualization();
}

function showFilter(ev) {
  console.log($(ev.target).attr("data-value"));
}


function init_labels(fields) {
  var source = $("#label-template").html();
  var template = Handlebars.compile(source);
  for (var i=0; i<fields.length; i++) {
    var field = fields[i];
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
  $('[data-toggle="popover"]').popover({html: true});
}

function init_functions() {
  $.each(["Count", "Count Unique Values", "Sum", "Average", "Minimum", "Maximum"], function() {
      var funcString = this.toString();
      $("#functions").append($('<option></option>').attr("value", this).text(funcString));
  });
}

function init_charts() {
  $.each(["Heatmap", "Line Chart", "Bar Chart", "Stacked Bar Chart", "Area Chart", "Scatter Chart"], function() {
    $("#charts").append($('<option></option>').attr("value", this).text(this));
  })
}

function updateVisualization() {
    var rows = get_data("#rowdrop");
    var cols = get_data("#coldrop");
    var vals = get_data("#valdrop");
    var operation = $("#functions").val();
    var chartType = $("#charts").val();
    applyVisualization(rows,cols,vals,operation,chartType);
    }

function applyVisualization(rows,cols,vals,operation,chartType) {
    $("#table").pivot(results.data, {
        rows: rows,
        cols: cols,
        aggregator: $.pivotUtilities.aggregators[operation](vals),
        renderer: $.pivotUtilities.renderers[$("#charts").val()],
    });

    // Set QueryString
    var queryString = '?rows='+rows+'&cols='+cols+'&opt='+
                        operation+'&optVal='+vals+'&chartType='+chartType;
    history.pushState({}, document.title, queryString);
    }

function adjustInitialDrag(parentDivId,targetDivId,fieldArray) {
    // Function to populate fields in row and column div as per Querystring
    for(var iterfield=0; iterfield<fieldArray.length; iterfield++) {
        var fieldElem = $("#"+parentDivId+" span[data-value='"+fieldArray[iterfield]+"']");
        $("#"+targetDivId).append(fieldElem);
        }
    }

function get_data(drop) {
  return $(drop).children().map(function() { return $(this).attr('data-value') }).toArray();
}

function allowDrop(ev) {
  ev.preventDefault();
}

function drag(ev) {
  ev.dataTransfer.setData("Text", ev.target.id);
}

function drop(ev) {
  ev.preventDefault();
  var data = ev.dataTransfer.getData("Text");
  if($(ev.target).hasClass("drop")) {
    ev.target.appendChild(document.getElementById(data));
  }
  updateVisualization();
}
