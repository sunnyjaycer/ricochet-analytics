const axios = require('axios')
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

USDC_WETH = "0x8082Ab2f4E220dAd92689F3682F3e7a42b206B42"
USDC_WBTC = "0xe0A0ec8dee2f73943A6b731a2e11484916f45D44"
DAI_WETH1 = "0x27C7D067A0C143990EC6ed2772E7136Cfcfaecd6"
DAI_WETH2 = "0x9BEf427fa1fF5269b824eeD9415F7622b81244f5"
DAI_MKR = "0x47de4Fd666373Ca4A793e2E0e7F995Ea7D3c9A29"

let market = ""

const prompt = require('prompt');

prompt.start();

prompt.get(['StreamMarketAddress'], function (err, result) {
    if (err) { return onErr(err); }
    console.log('Provided Address: ' + result.StreamMarketAddress + "\n");
    market = result.StreamMarketAddress

  const QUERY_URL = `https://api.thegraph.com/subgraphs/name/superfluid-finance/superfluid-matic`

  const query = `{
      account(id: "${market.toLowerCase()}") {
          flowsOwned {
              lastUpdate
              flowRate
              sum
              recipient {
                id
              }
              token { 
                  id
                  symbol
              }
              events {
                flowRate
                sum
                transaction {
                  timestamp
                }
              }
          }
          flowsReceived {
            lastUpdate
            flowRate
            sum
            owner {
              id
            }
            token { 
                id
                symbol
            }
            events {
              flowRate
              sum
              transaction {
                timestamp
              }
            }
          }
          
      }
  }`

  axios.post(QUERY_URL, { query }).then(result => {
      const data = []

      let tvs = 0
      let ts = 0
      let tas = 0

      for (let i = 0; i < result.data.data.account.flowsReceived.length; i++) {
          console.log( result.data.data.account.flowsReceived[i].owner.id + " | " + ( result.data.data.account.flowsReceived[i].flowRate*(30*24*60*60) / Math.pow(10,18) ).toFixed(4).toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",") )
          data.push({address:result.data.data.account.flowsReceived[i].owner.id , rate:( result.data.data.account.flowsReceived[i].flowRate*(30*24*60*60) / Math.pow(10,18) ).toFixed(4).toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",")})
          tvs += ( result.data.data.account.flowsReceived[i].flowRate*(30*24*60*60) / Math.pow(10,18) )
          ts += 1
          if (result.data.data.account.flowsReceived[i].flowRate != 0) {
              tas += 1
          }
      }
      console.log("\nTVS: " + tvs.toFixed(4).toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ","))
      console.log("\nTotal Streamers: " + ts)
      console.log("Total Active Streamers: " + tas + "\n")
      console.log("Average Stream: " + (tvs/tas).toFixed(4).toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",") )

      const csvWriter = createCsvWriter({
          path: 'out.csv',
          header: [
            {id: 'address', title: 'Address'},
            {id: 'rate', title: 'rate'}
          ]
      })

      csvWriter
      .writeRecords(data)
      .then(()=> console.log('The CSV file was written successfully'));

  })

});