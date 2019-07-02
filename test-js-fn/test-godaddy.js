const request = require("request");
let gdKey;
let gdSecret;

const gdApiUrl = "https://api.godaddy.com/v1/domains/anthonyamanse.space/records"

function main(params) {
  gdKey = params.gdKey;
  gdSecret = params.gdSecret;
  return removeRecord(params.challenge.txt_record_name, params.challenge.txt_record_val);
  // return insertRecord(params.challenge.txt_record_name, params.challenge.txt_record_val);
}

function insertRecord(name, value) {
  const options = {
    method: 'PATCH',
    json: true,
    headers: {
      Authorization: "sso-key " + gdKey + ":" + gdSecret
    },
    body: [{
      name: name,
      data: value,
      type: "TXT",
      ttl: 600
    }],
    uri: gdApiUrl
  };

  return new Promise(function (resolve, reject) {
    request(options, function(err, response, body) {
      if (err != null || response.statusCode != 200) {
        reject({err, body})
      }
      resolve({
        status: "Response from server is: " + response.statusCode,
        result: "Successfully added TXT record."})
    })
  })
}

function getRecords() {
  const options = {
    method: 'GET',
    headers: {
      Authorization: "sso-key " + gdKey + ":" + gdSecret
    },
    uri: gdApiUrl
  };

   return new Promise(function (resolve, reject) {
     request(options, function(err, response, body) {
        if (err != null || response.statusCode != 200) {
          reject({err, body})
        }
        resolve({records: JSON.parse(body)})
     })
   })
}

function removeRecord(name, value) {
  return new Promise(function (resolve, reject) {
    // get current records
    getRecords().then(function (object) {
      // remove specified record with name and value
      let filtered = object.records.filter(function (obj, index, arr) {
        if (obj.name != name && obj.value != value) {
          return true;
        } else {
          return false;
        }
      })

      const options = {
        method: 'PUT',
        json: true,
        headers: {
          Authorization: "sso-key " + gdKey + ":" + gdSecret
        },
        body: filtered,
        uri: gdApiUrl
      }

      request(options, function (err, response, body) {
        if (err != null || response.statusCode != 200) {
          reject({err, body})
        }
        resolve({
          status: "Response from server is: " + response.statusCode,
          result: "Successfully removed a TXT record."})
      })
    })
  })
}
