const axios = require('axios')
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const Decimal = require('decimal.js')

USDC_WETH = "0x8082Ab2f4E220dAd92689F3682F3e7a42b206B42"
DAI_WETH = "0x27C7D067A0C143990EC6ed2772E7136Cfcfaecd6"
DAI_MKR = "0x47de4Fd666373Ca4A793e2E0e7F995Ea7D3c9A29"


const QUERY_URL = `https://api.thegraph.com/subgraphs/name/superfluid-finance/superfluid-matic`

const query = `{
    account(id: "${DAI_WETH.toLowerCase()}") {
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

// pagination in GraphQL with first/skip is infeasible on massive datasets
// best practice is to orderBy something like a timestamp, then use that as
// a pagination variable.
const flowsReceivedQuery = (address, paginator) => (
  `{
    account(id: "${address.toLowerCase()}") {
      flowsReceived (
        first: 1000
        orderBy: lastUpdate
        where: {
          lastUpdate_gt: "${paginator}"
        }
      ) {
        flowRate
        lastUpdate
        owner { id }
      }
    }
  }`
)

const secondsInAMonth = 30 * 24 * 60 * 60

const getFlowsReceived = async () => {
  let paginator = 0
  let allFlowsReceived = []
  // loop until all fetched
  while (true) {
    try {
      // format and run query
      const query = flowsReceivedQuery(DAI_WETH, paginator)
      const result = await axios.post(QUERY_URL, { query })
      const { flowsReceived } = result.data.data.account
      // concat result flows to all flows
      allFlowsReceived = allFlowsReceived.concat(flowsReceived)
      // increment the paginator by lastUpdate
      paginator = allFlowsReceived[allFlowsReceived.length -1].lastUpdate
      // if all fetched, break
      if (flowsReceived.length < 1000) break 
    } catch (error) { throw error }
  }

  // all results fetched
  const allActiveFlowsReceived = allFlowsReceived
  .filter(flow => flow.flowRate > 0)

  let ts = allFlowsReceived.length
  let tas = allActiveFlowsReceived.length
  // numeric string for Decimal.js (arbitrarily sized numbers)
  let tvs = new Decimal(0)
  let data = []
  for (const flowReceived of allActiveFlowsReceived) {
    const { flowRate, owner } = flowReceived
    const rate = new Decimal(flowRate).mul(new Decimal(secondsInAMonth).mul(new Decimal(1e-18))).toDecimalPlaces(4)
    tvs = tvs.add(rate)
    data.push({ address: owner.id, rate: rate.toString() })
    console.log(`${owner.id} | ${rate}`)
  }
  let formattedTvs = tvs.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",")
  console.log("\nTVS: " + formattedTvs)
  console.log("\nTotal Streamers: " + ts)
  console.log("Total Active Streamers: " + tas + "\n")

  const csvWriter = createCsvWriter({
      path: 'out.csv',
      header: [
        {id: 'address', title: 'Address'},
        {id: 'rate', title: 'rate'}
      ]
  })

  csvWriter
  .writeRecords(data)
  .then(()=> console.log('The CSV file was written successfully'))
  .catch(error => { throw error })
}

getFlowsReceived().catch(e => { console.error(e) })

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

})