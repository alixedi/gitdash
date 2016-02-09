// Loading Google Viz API Core Charts
google.load("visualization", "1", {packages:["corechart"]});
renderers = $.extend($.pivotUtilities.renderers, 
                     $.pivotUtilities.gchart_renderers,
                     {"Geo Chart": makeGoogleChart("GeoChart", {
                        region: mapRegion,
                        displayMode: "markers",
                        colorAxis: {colors: ["orange", "red"]}})});

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
    results = $.parse(data);
    // Init labels
    init_labels(results.results.fields);
    init_functions();
    init_charts();
    // Loading visulaization as per QueryString
    if (jQuery.isEmptyObject(queryStringDict)) {
        $("#table").pivot(results.results.rows);
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
  init_labels(results.results.fields);
}

function updateVisFromQueryString(queryStrDict) {
  flushAndReset();
  $('#functions').val(queryStrDict.opt);
  $('#charts').val(queryStrDict.chartType);
  $('select').selectpicker('render');
  var userColValues = queryStrDict.cols.split(',');
  var userRowValues = queryStrDict.rows.split(',');
  var userNumValues = queryStrDict.optVal.split(',');
  adjustInitialDrag('parking','coldrop',userColValues);
  adjustInitialDrag('parking','rowdrop',userRowValues);
  adjustInitialDrag('parking','valdrop',userNumValues);
  updateVisualization();
}

function init_labels(fields) {
  for (var i=0; i<fields.length; i++) {
    $('#parking').append('<span class="label label-danger" id="f' + i + '" data-value="' + fields[i] + '" ondragstart="drag(event)" draggable="true">' + fields[i] + '</span> ');
  }
}

function init_functions() {
  $.each(Object.keys($.pivotUtilities.aggregators), function() {
      var aggregationMappingDict = {
          'sum':'Sum', 'count':'Count', 'average':'Average',
          'sumAsFractionOfTotal':'% of Total (Sum)',
          'sumAsFractionOfRow':'% of Row Total (Sum)',
          'sumAsFractionOfCol':'% of Column Total (Sum)',
          'countAsFractionOfTotal':'% of Total (Count)',
          'countAsFractionOfRow':'% of Row Total (Count)',
          'countAsFractionOfCol':'% of Column Total (Count)',
          'countUnique':'Count Unique', 'listUnique':'List Unique',
          'intSum':'intSum', 'sumOverSum':'sumOverSum',
          'ub80':'Upper Bound Binomial', 'lb80':'Lower Bound Binomial',
        };
      if (this in aggregationMappingDict) {
          var funcString = this.toString();
          $("#functions").append($('<option></option>').attr("value", this).text(aggregationMappingDict[funcString]));
        }
  });
}

function init_charts() {
  $.each(Object.keys(renderers), function() {
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
    $("#table").pivot(results.results.rows, {
        rows: rows,
        cols: cols,
        aggregator: $.pivotUtilities.aggregators[operation](vals),
        renderer: renderers[$("#charts").val()],
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
