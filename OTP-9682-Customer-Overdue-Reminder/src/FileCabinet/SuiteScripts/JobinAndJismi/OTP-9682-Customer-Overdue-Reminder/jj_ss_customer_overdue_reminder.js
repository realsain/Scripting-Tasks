/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */

/************************************************************************************************ 
 *  
 * OTP-9682 : Monthly Over Due Reminder for Customer
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 28-October-2025 
 * 
 * Description : Scheduled script automates the process of identifying, grouping, and notifying customers with overdue invoices in NetSuite.
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 28-October-2025 :  The initial build was created by JJ0419
 * 
*************************************************************************************************/ 

define(['N/email', 'N/log', 'N/record', 'N/search', 'N/file'],
    /**
 * @param{email} email
 * @param{log} log
 * @param{record} record
 * @param{search} search
 * @param{file} file
 */
    (email, log, record, search, file) => {

        const ADMIN_ID = -5;

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {
            try {
                const invoices = getOverdueInvoices();
                if (!invoices || invoices.length === 0) {
                    log.audit('No Data', 'No overdue invoices found for this month!');
                    return;
                }

                const customerMap = groupInvoicesByCustomer(invoices);

                for (const [customerId, custInvoices] of Object.entries(customerMap)) {
                    try {
                        const customerRecord = record.load({ type: record.Type.CUSTOMER, id: customerId });
                        const customerEmail = customerRecord.getValue('email');
                        const customerName = customerRecord.getValue('altname') || customerRecord.getValue('companyname') || customerRecord.getValue('entityid');
                        const isInactive = customerRecord.getValue('isinactive');

                        if (isInactive) {
                            log.audit('Inactive Customer Skipped', `Customer "${customerName}" (ID: ${customerId}) is inactive. Skipping email.`);
                            continue;
                        }

                        if (!customerEmail) {
                            log.error('Missing Customer Email', `Cannot send email to ${customerName} because reciever has no email. Skipping!`);
                            continue;
                        }

                        const salesRepId = customerRecord.getValue('salesrep');
                        const senderId = getSenderId(salesRepId);
                        const senderName = getEmployeeName(senderId);

                        const senderRole = (salesRepId) ? 'Sales Rep' : 'Administrator';

                        let senderEmail = null;
                        try {
                            const senderRecord = record.load({
                                type: record.Type.EMPLOYEE,
                                id: senderId
                            });
                            senderEmail = senderRecord.getValue('email');
                        }
                        catch (err) {
                            log.error('Load Sender Error', `Cannot load sender record ID: ${senderId}!, Error: ${err}`);
                        }

                        if (!senderEmail) {
                            log.error('Missing Sender Email', `Cannot send email to ${customerName} because sender ${senderName} (${senderRole}) has no email. Skipping!`);
                            continue;
                        }

                        const csvFile = generateCSV(customerName, customerEmail, custInvoices);
                        sendEmail(customerEmail, customerName, senderId, csvFile, senderName, senderRole);

                        log.audit('Email Sent', `Email sent to ${customerName} from ${senderName} (${senderRole})`);
                    }
                    catch (customerErr) {
                        log.error('Customer Processing Error', customerErr);
                    }
                }

            }
            catch (err) {
                log.error('Script Error', err);
            }
        };

        /**
         * Retrieves overdue invoices from NetSuite.
         * @returns {Array<Object>} List of overdue invoices
         * @returns {string} return[].invoiceId - Internal ID of the invoice
         * @returns {string} return[].invoiceNumber - Invoice transaction number
         * @returns {string} return[].customerId - Internal ID of the customer
         * @returns {number} return[].amount - Invoice amount
         * @returns {string} return[].dueDate - Due date of the invoice
         */
        function getOverdueInvoices() {
            try {
                const invoiceSearch = search.create({
                    type: search.Type.INVOICE,
                    filters: [
                        ['type', 'anyof', 'CustInvc'],
                        'AND',
                        ['status', 'anyof', 'CustInvc:A'],
                        'AND',
                        ['duedate', 'onorbefore', 'lastmonth'],
                        'AND',
                        ['mainline', 'is', 'T']
                    ],
                    columns: ['internalid', 'tranid', 'entity', 'amount', 'duedate']
                });

                const results = [];
                invoiceSearch.run().each(result => {
                    results.push({
                        invoiceId: result.getValue('internalid'),
                        invoiceNumber: result.getValue('tranid'),
                        customerId: result.getValue('entity'),
                        amount: result.getValue('amount'),
                        dueDate: result.getValue('duedate')
                    });
                    return true;
                });

                return results;
            }
            catch (err) {
                log.error('getOverdueInvoices Error', err);
                return [];
            }
        }

        /**
         * Groups invoices by their customer and calculates overdue days.
         * @param {Array<Object>} invoices - List of invoices
         * @returns {Object<string, Array<Object>>} Map of customer IDs to their overdue invoices
         */
        function groupInvoicesByCustomer(invoices) {
            try {
                const map = {};
                const today = new Date();

                invoices.forEach(invoice => {
                    if (!map[invoice.customerId]) map[invoice.customerId] = [];
                    const dueDate = new Date(invoice.dueDate);
                    const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                    map[invoice.customerId].push({
                        invoiceNumber: invoice.invoiceNumber,
                        amount: invoice.amount,
                        daysOverdue: daysOverdue
                    });
                });

                return map;
            } 
            catch (err) {
                log.error('groupInvoicesByCustomer Error', err);
                return {};
            }
        }

        /**
         * Determines the sender ID for the email.
         * @param {number|string} salesRepId - Sales representative internal ID
         * @returns {number} Sender ID (Sales Rep or Administrator)
         */
        function getSenderId(salesRepId) {
            return salesRepId || ADMIN_ID;
        }

        /**
         * Retrieves an employee's name using their internal ID.
         * @param {number|string} employeeId - Internal ID of the employee
         * @returns {string} Employee name or 'Unknown' if unavailable
         */
        function getEmployeeName(employeeId) {
            try {
                const empRecord = record.load({
                    type: record.Type.EMPLOYEE,
                    id: employeeId
                });
                return empRecord.getValue('entityid') || 'Unknown';
            }
            catch (err) {
                log.error('Get Employee Name Error', `Employee ID: ${employeeId}, Error: ${err}`);
                return 'Unknown';
            }
        }

        /**
         * Generates a CSV file for the customer's overdue invoices.
         * @param {string} customerName - Customer name
         * @param {Array<Object>} invoices - List of overdue invoices
         * @returns {N/file.File} NetSuite file object containing the CSV
         */
        function generateCSV(customerName, customerEmail, invoices) {
            try {
                let csvContent = 'Customer Name,Customer Email,Invoice Document Number,Invoice Amount,Days Overdue\n';
                invoices.forEach(inv => {
                    csvContent += `${customerName},${customerEmail},${inv.invoiceNumber},${inv.amount},${inv.daysOverdue}\n`;
                });

                return file.create({
                    name: `Overdue_Invoices_${customerName.replace(/\s+/g, '_')}.csv`,
                    fileType: file.Type.CSV,
                    contents: csvContent
                });
            } 
            catch (err) {
                log.error('generateCSV Error', err);
                return null;
            }
        }

        /**
         * Sends an email with the overdue invoice CSV attachment.
         * @param {string} toEmail - Recipient email address
         * @param {string} customerName - Customer name
         * @param {number} authorId - Sender internal ID
         * @param {N/file.File} attachment - CSV file attachment
         * @param {string} senderName - Name of the sender
         * @param {string} senderRole - Role of the sender (Sales Rep / Administrator)
         */
        function sendEmail(toEmail, customerName, authorId, attachment, senderName, senderRole) {
            try {
                email.send({
                    author: authorId,
                    recipients: toEmail,
                    subject: `Monthly Overdue Invoice Reminder`,
                    body: `Dear ${customerName},\n\nPlease find attached the overdue invoices summary till last month.\n\nRegards,\n${senderName} (${senderRole})`,
                    attachments: [attachment]
                });
            } 
            catch (err) {
                log.error('Email Send Error', `Customer: ${customerName}, Error: ${err}`);
            }
        }

        return { execute }

    });