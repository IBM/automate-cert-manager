const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const request = require('request');

const gdKey = process.env.GODADDY_KEY
const gdSecret = process.env.GODADDY_SECRET
const gdApiUrl = "https://api.godaddy.com/v1/domains/" + process.env.GODADDY_DOMAIN + "/records"
const certificateManagerApiUrl = "https://" + process.env.CM_REGION + ".certificate-manager.cloud.ibm.com";
const allowedCM = process.env.ALLOWED_CM

router.post("/", function (req, res) {
  const unverifiedData = jwt.decode(req.body.data);
  // allowed certificate manager instance set in environment variable
  if (allowedCM != unverifiedData.instance_crn) {
    res.status(403).send({message: 'Unauthorized'});
    return;
  }

  getPublicKey(unverifiedData.instance_crn, certificateManagerApiUrl)
    .then(function (object) {
      return verifyAndDecode(req.body.data, object.publicKey)
    })
    .then(function (object) {

      switch (object.decodedData.event_type) {
        // add case for cert about to expire event
        // cert_about_to_expire_renew_required
        case "cert_domain_validation_required":
          insertRecord(object.decodedData.challenge.txt_record_name, object.decodedData.challenge.txt_record_val)
            .then(function (object) {
              res.send(object);
            })
          break;
        case "cert_domain_validation_completed":
          removeRecord(object.decodedData.challenge.txt_record_name, object.decodedData.challenge.txt_record_val)
            .then(function (object) {
              res.send(object);
            })
          break;
        default:
          res.send({"status":"Default to 200"});
      }
    })
    .catch(function (error) {
      res.status(400).send(error);
      return;
    })
})

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

module.exports = router;
