/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/record', 'N/search', 'N/email'],
    /**
 * @param{log} log
 * @param{record} record
 * @param{search} search
 * @param{email} email
 */
    (log, record, search, email) => {

        function getSalesRepEmail(customerId) {
            try {
                const customerSearch = search.create({
                    type: search.Type.CUSTOMER,
                    filters: [['internalid', 'is', customerId]],
                    columns: [
                        search.createColumn({ name: 'salesrep' }),
                        search.createColumn({ name: 'email', join: 'salesrep' })
                    ]
                });

                const results = customerSearch.run().getRange({ start: 0, end: 1 });

                if (!results || results.length === 0) {
                    log.audit('Customer Not Found', `No customer found for ID: ${customerId}`);
                    return null;
                }

                const salesRepId = results[0].getValue('salesrep');
                const salesRepEmail = results[0].getValue({
                    name: 'email',
                    join: 'salesrep'
                });

                if (!salesRepId) {
                    log.audit('No Sales Rep Assigned', `Customer ID ${customerId} does not have a Sales Rep.`);
                    return null;
                }

                if (salesRepId && !salesRepEmail) {
                    log.audit('Sales Rep Found But No Email', `Sales Rep ID ${salesRepId} has no email.`);
                    return null;
                }

                log.audit('Sales Rep Email Found', salesRepEmail);
                return salesRepEmail;

            }
            catch (error) {
                log.error('Error in getSalesRepEmail', error);
                return null;
            }
        }

        function sendNotifications(custName, custEmail, subject, message, customerId, salesRepEmail) {
            try {
                const adminId = -5;

                if (!adminId) {
                    log.audit('Admin Not Found', 'Admin ID is missing or invalid. Cannot send notification.');
                    return;
                }

                const emailBody = `
                    A new external contact form has been submitted:<br><br>
                    <b>Customer Name:</b> ${custName || 'Not Provided'}<br>
                    <b>Email:</b> ${custEmail || 'Not Provided'}<br>
                    <b>Subject:</b> ${subject || 'Not Provided'}<br>
                    <b>Message:</b><br>${message || 'No message provided'}<br><br>
                    <b>Linked Customer:</b> ${customerId ? customerId : 'No match found'}
                `;

                email.send({
                    author: adminId,
                    recipients: adminId,
                    subject: `New External Form Submission - ${subject || 'No Subject'}`,
                    body: emailBody
                });
                log.audit('Admin Email Sent', `To Admin ID = ${adminId}`);

                if (salesRepEmail) {
                    email.send({
                        author: adminId,
                        recipients: salesRepEmail,
                        subject: `New Customer Submission - ${custName || 'Unnamed Customer'}`,
                        body: emailBody
                    });
                    log.audit('Sales Rep Email Sent', salesRepEmail);
                }
                else {
                    log.audit('No Sales Rep Email Available', 'Skipping Sales Rep notification.');
                }

            }
            catch (error) {
                log.error('Error in sendNotifications', error);
            }
        }

        const afterSubmit = (scriptContext) => {
            try {
                if (scriptContext.type !== scriptContext.UserEventType.CREATE) return;

                const newRec = scriptContext.newRecord;
                const custName = newRec.getValue('custrecord_jj_customer_name');
                const custEmail = newRec.getValue('custrecord_jj_customer_email');
                const subject = newRec.getValue('custrecord_jj_subject');
                const message = newRec.getValue('custrecord_jj_message');
                const customerId = newRec.getValue('custrecord_jj_customer_reference');

                log.audit('New Custom Record Created', `Customer: ${custName}, Email: ${custEmail}`);

                if (!customerId) {
                    log.audit('No Customer Linked', `External form email ${custEmail || 'N/A'} did not match any customer.`);
                }

                const salesRepEmail = customerId ? getSalesRepEmail(customerId) : null;

                sendNotifications(custName, custEmail, subject, message, customerId, salesRepEmail);

            }
            catch (error) {
                log.error('Error in afterSubmit', error);
            }
        };

        return { afterSubmit }

    });
