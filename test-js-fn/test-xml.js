var parseString = require('xml2js').parseString;
var xml = "<root key1='value' key2='value2'>Hello xml2js!</root>"
parseString(xml, {mergeAttrs: true},
  function (err, result) {
    console.log(result);
});
