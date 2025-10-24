/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/email', 'N/format', 'N/log', 'N/record', 'N/runtime', 'N/search', 'N/file'],
    /**
 * @param{email} email
 * @param{format} format
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 * @param{file} file
 */
    (email, format, log, record, runtime, search, file) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */

        const ADMIN_ID = -5;

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

        function groupInvoicesByCustomer(invoices) {
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

        function getSenderId(salesRepId) {
            return salesRepId || ADMIN_ID;
        }

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

        function generateCSV(customerName, invoices) {
            let csvContent = 'Invoice Number,Invoice Amount,Days Overdue\n';
            invoices.forEach(inv => {
                csvContent += `${inv.invoiceNumber},${inv.amount},${inv.daysOverdue}\n`;
            });

            return file.create({
                name: `Overdue_Invoices_${customerName}.csv`,
                fileType: file.Type.CSV,
                contents: csvContent
            });
        }

        function sendEmail(toEmail, customerName, authorId, attachment, senderName, senderRole) {
            try {
                email.send({
                    author: authorId,
                    recipients: toEmail,
                    subject: `Monthly Overdue Invoice Reminder`,
                    body: `Dear ${customerName},\n\nPlease find attached the overdue invoices summary till last month.\n\nRegards,\n${senderName} (${senderRole})`,
                    attachments: [attachment]
                });
            } catch (err) {
                log.error('Email Send Error', `Customer: ${customerName}, Error: ${err}`);
            }
        }



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
                        const customerName = customerRecord.getValue('entityid');

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

                        const csvFile = generateCSV(customerName, custInvoices);
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

        return { execute }

    });