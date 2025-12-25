/**
 * Test SMS Notification Script
 * Run this script to test NetGSM SMS integration
 * 
 * Usage: node scripts/test-sms.js
 */

const NETGSM_USERNAME = process.env.NETGSM_USERNAME || "8503023077"
const NETGSM_PASSWORD = process.env.NETGSM_PASSWORD || "2C.F26D"
const NETGSM_HEADER = process.env.NETGSM_HEADER || "TALYA SMART"
const API_URL = "https://api.netgsm.com.tr/sms/rest/v2/send"

/**
 * Send test SMS
 */
async function testSMS() {
  console.log("🚀 Testing NetGSM SMS Integration...")
  console.log("=" .repeat(50))

  // Check credentials
  if (!NETGSM_USERNAME || !NETGSM_PASSWORD) {
    console.error("❌ Error: NetGSM credentials not configured")
    console.log("Please set NETGSM_USERNAME and NETGSM_PASSWORD environment variables")
    process.exit(1)
  }

  console.log("✅ Credentials found")
  console.log(`   Username: ${NETGSM_USERNAME}`)
  console.log(`   Header: ${NETGSM_HEADER}`)
  console.log()

  // Prepare test message
  const payload = {
    msgheader: NETGSM_HEADER,
    encoding: "TR",
    iysfilter: "",
    partnercode: "",
    messages: [
      {
        msg: "Test message from TSmart Warehouse - NetGSM integration working!",
        no: "5416393028",
      },
    ],
  }

  console.log("📤 Sending test SMS...")
  console.log(`   To: ${payload.messages[0].no}`)
  console.log(`   Message: ${payload.messages[0].msg}`)
  console.log()

  try {
    // Create Basic Auth credentials
    const credentials = Buffer.from(`${NETGSM_USERNAME}:${NETGSM_PASSWORD}`).toString("base64")

    // Send request
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    console.log(`📡 Response Status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ Error Response:", errorText)
      process.exit(1)
    }

    const data = await response.json()
    console.log("📥 Response Data:", JSON.stringify(data, null, 2))
    console.log()

    // Check response code
    if (data.code === "00" || data.code === 0) {
      console.log("✅ SUCCESS! SMS sent successfully!")
      console.log(`   Message ID: ${data.bulkid || data.jobID || "N/A"}`)
    } else {
      console.error("❌ FAILED! NetGSM error code:", data.code)
      console.log("   Error details:", getErrorMessage(data.code))
    }

  } catch (error) {
    console.error("❌ Error:", error.message)
    process.exit(1)
  }

  console.log()
  console.log("=" .repeat(50))
  console.log("✅ Test completed!")
}

/**
 * Get error message from NetGSM error code
 */
function getErrorMessage(code) {
  const errorMessages = {
    "00": "Success",
    "01": "Invalid username or password",
    "02": "Insufficient balance",
    "20": "Invalid message header",
    "30": "Invalid phone number",
    "40": "Message header not defined",
    "50": "System error",
    "51": "Invalid encoding",
    "70": "Invalid parameters",
    "85": "Invalid phone number format",
  }

  return errorMessages[String(code)] || "Unknown error"
}

/**
 * Test bulk SMS
 */
async function testBulkSMS() {
  console.log("🚀 Testing Bulk SMS...")
  console.log("=" .repeat(50))

  const payload = {
    msgheader: NETGSM_HEADER,
    encoding: "TR",
    iysfilter: "",
    partnercode: "",
    messages: [
      {
        msg: "Test message 1 from TSmart Warehouse",
        no: "5416393028",
      },
      {
        msg: "Test message 2 from TSmart Warehouse",
        no: "5333333333",
      },
    ],
  }

  console.log(`📤 Sending ${payload.messages.length} SMS messages...`)
  console.log()

  try {
    const credentials = Buffer.from(`${NETGSM_USERNAME}:${NETGSM_PASSWORD}`).toString("base64")

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    console.log(`📡 Response Status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ Error Response:", errorText)
      process.exit(1)
    }

    const data = await response.json()
    console.log("📥 Response Data:", JSON.stringify(data, null, 2))
    console.log()

    if (data.code === "00" || data.code === 0) {
      console.log("✅ SUCCESS! Bulk SMS sent successfully!")
      console.log(`   Bulk ID: ${data.bulkid || data.jobID || "N/A"}`)
      console.log(`   Messages sent: ${payload.messages.length}`)
    } else {
      console.error("❌ FAILED! NetGSM error code:", data.code)
      console.log("   Error details:", getErrorMessage(data.code))
    }

  } catch (error) {
    console.error("❌ Error:", error.message)
    process.exit(1)
  }

  console.log()
  console.log("=" .repeat(50))
  console.log("✅ Test completed!")
}

// Main execution
const args = process.argv.slice(2)
const command = args[0] || "single"

console.log()
console.log("📱 NetGSM SMS Test Script")
console.log("=" .repeat(50))
console.log()

if (command === "bulk") {
  testBulkSMS()
} else {
  testSMS()
}

