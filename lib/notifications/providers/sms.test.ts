/**
 * SMS Provider Test Utilities
 * Use these examples to test SMS functionality
 */

import { NetGSMProvider } from "./sms"

/**
 * Test single SMS send
 */
export async function testSingleSMS() {
  const provider = new NetGSMProvider()

  const result = await provider.send({
    to: "5416393028",
    message: "Test message from TSmart Warehouse",
  })

  console.log("Single SMS Result:", result)
  return result
}

/**
 * Test bulk SMS send
 */
export async function testBulkSMS() {
  const provider = new NetGSMProvider()

  const result = await provider.sendBulk({
    messages: [
      { to: "5416393028", msg: "Test message 1" },
      { to: "5333333333", msg: "Test message 2" },
    ],
  })

  console.log("Bulk SMS Result:", result)
  return result
}

/**
 * Example: Send booking confirmation SMS
 */
export async function sendBookingConfirmationSMS(
  phoneNumber: string,
  bookingDetails: {
    bookingId: string
    warehouseName: string
    startDate: string
    endDate: string
  }
) {
  const provider = new NetGSMProvider()

  const message = `Rezervasyon Onayı\nID: ${bookingDetails.bookingId}\nDepo: ${bookingDetails.warehouseName}\nTarih: ${bookingDetails.startDate} - ${bookingDetails.endDate}\nTSmart Warehouse`

  return await provider.send({
    to: phoneNumber,
    message,
  })
}

/**
 * Example: Send task assignment SMS
 */
export async function sendTaskAssignmentSMS(
  phoneNumber: string,
  taskDetails: {
    taskId: string
    taskTitle: string
    dueDate: string
  }
) {
  const provider = new NetGSMProvider()

  const message = `Yeni Görev\n${taskDetails.taskTitle}\nSon Tarih: ${taskDetails.dueDate}\nGörev ID: ${taskDetails.taskId}\nTSmart Warehouse`

  return await provider.send({
    to: phoneNumber,
    message,
  })
}

/**
 * Example: Send invoice reminder SMS
 */
export async function sendInvoiceReminderSMS(
  phoneNumber: string,
  invoiceDetails: {
    invoiceNumber: string
    amount: string
    dueDate: string
  }
) {
  const provider = new NetGSMProvider()

  const message = `Fatura Hatırlatma\nFatura No: ${invoiceDetails.invoiceNumber}\nTutar: ${invoiceDetails.amount} TL\nSon Ödeme: ${invoiceDetails.dueDate}\nTSmart Warehouse`

  return await provider.send({
    to: phoneNumber,
    message,
  })
}

/**
 * Example: Send bulk notification to multiple workers
 */
export async function sendBulkWorkerNotification(
  workers: Array<{ phone: string; name: string }>,
  message: string
) {
  const provider = new NetGSMProvider()

  const messages = workers.map((worker) => ({
    to: worker.phone,
    message: `Merhaba ${worker.name},\n${message}\nTSmart Warehouse`,
  }))

  return await provider.sendBulk({ messages })
}

