/**
  *
  * main() will be run when you invoke this action
  *
  * @param Cloud Functions actions accept a single parameter, which must be a JSON object.
  *
  * @return The output of this action, which must be a JSON object.
  *
  */
const request = require("request");
const jwt = require('jsonwebtoken');

let gdKey;
let gdSecret;
let gdApiUrl;

function main(params) {
  gdKey = params.gdKey;
  gdSecret = params.gdSecret;
  gdApiUrl = "https://api.godaddy.com/v1/domains/" + params.gdDomain + "/records"

  const unverifiedData = jwt.decode(params.data);
  // allowed certificate manager instance set in action parameters
  if (params.allowedCM != unverifiedData.instance_crn) {
    return Promise.reject({
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Unauthorized' },
    });
  }

  const certificateManagerApiUrl = "https://" + params.cmRegion + ".certificate-manager.cloud.ibm.com";
  return getPublicKey(unverifiedData.instance_crn, certificateManagerApiUrl)
    .then(function (object) {
      return verifyAndDecode(params.data, object.publicKey)
    })
    .then(function (object) {

      switch (object.decodedData.event_type) {
        // add case for cert about to expire event
        // cert_about_to_expire_renew_required
        case "cert_domain_validation_required":
          return insertRecord(object.decodedData.challenge.txt_record_name, object.decodedData.challenge.txt_record_val)
        case "cert_domain_validation_completed":
          return removeRecord(object.decodedData.challenge.txt_record_name, object.decodedData.challenge.txt_record_val)
        default:
          return new Promise(function (resolve, reject) {
            resolve({
              statusCode: 200,
              headers: {'Content-Type': 'application/json'},
              body: {}
            })
          })
      }
    })
}

// DNS Provider specific
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
    request(options, function (err, response, body) {
      if (err != null || response.statusCode != 200) {
        reject({ err, body })
      }
      resolve({
        status: "Response from server is: " + response.statusCode,
        result: "Successfully added TXT record."
      })
    })
  })
}

// DNS Provider specific
function getRecords() {
  const options = {
    method: 'GET',
    headers: {
      Authorization: "sso-key " + gdKey + ":" + gdSecret
    },
    uri: gdApiUrl
  };

  return new Promise(function (resolve, reject) {
    request(options, function (err, response, body) {
      if (err != null || response.statusCode != 200) {
        reject({ err, body })
      }
      resolve({ records: JSON.parse(body) })
    })
  })
}

// DNS Provider specific
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
          reject({ err, body })
        }
        resolve({
          status: "Response from server is: " + response.statusCode,
          result: "Successfully removed a TXT record."
        })
      })
    })
  })
}

function getPublicKey(instance_crn, url) {
  const options = {
    method: 'GET',
    url: url + "/api/v1/instances/" + encodeURIComponent(instance_crn) + "/notifications/publicKey?keyFormat=pem",
    headers: {
      'cache-control': 'no-cache'
    }
  }

  return new Promise(function (resolve, reject) {
    request(options, function (err, response, body) {
      if (err != null || response.statusCode != 200) {
        reject({ err, body })
      }
      resolve({ publicKey: JSON.parse(body).publicKey })
    })
  })
}

function verifyAndDecode(data, publicKey) {
  return new Promise(function (resolve, reject) {
    jwt.verify(data, publicKey, function (err, decoded) {
      if (err != null) {
        reject({ err })
      }
      // remove log
      console.log(decoded)
      resolve({ decodedData: decoded })
    })
  })
}
