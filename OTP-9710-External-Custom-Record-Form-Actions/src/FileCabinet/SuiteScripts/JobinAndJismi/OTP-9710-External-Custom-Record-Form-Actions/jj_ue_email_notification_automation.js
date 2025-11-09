/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/************************************************************************************************ 
 *  
 * OTP-9710 : External Custom Record form and actions
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 28-October-2025 
 * 
 * Description : Suitelet and UserEvent scripts enable external users to submit customer queries directly into NetSuite without login access. 
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 28-October-2025 :  The initial build was created by JJ0419
 * 
*************************************************************************************************/ 

define(['N/log', 'N/search', 'N/email'],
    /**
 * @param{log} log
 * @param{search} search
 * @param{email} email
 */
    (log, search, email) => {

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
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

        /**
         * Retrieves the Sales Representative's email address linked to a given customer.
         *
         * @param {number|string} customerId - Internal ID of the customer record.
         * @returns {string|null} The Sales Representative's email address, or null if not found.
         */
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

        /**
         * Sends email notifications to the Admin and (if applicable) the Sales Representative
         * when a new external contact form is submitted.
         *
         * @param {string} custName - Name of the customer submitting the form.
         * @param {string} custEmail - Email address of the customer.
         * @param {string} subject - Subject of the message.
         * @param {string} message - Message body submitted by the customer.
         * @param {number|string|null} customerId - Linked customer internal ID (if matched).
         * @param {string|null} salesRepEmail - Sales Representative's email (if available).
         * @returns {void}
         */
        function sendNotifications(custName, custEmail, subject, message, customerId, salesRepEmail) {
            try {
                const adminId = -5;

                if (!adminId) {
                    log.audit('Admin Not Found', 'Admin ID is missing or invalid. Cannot send notification.');
                    return;
                }

                const formattedMessage = `
                    <p><b>Customer Name:</b> ${custName || 'Not Provided'}</p>
                    <p><b>Email:</b> ${custEmail || 'Not Provided'}</p>
                    <p><b>Subject:</b> ${subject || 'Not Provided'}</p>
                    <p><b>Message:</b><br>${message || 'No message provided'}</p>
                    <p><b>Linked Customer:</b> ${customerId ? customerId : 'No match found'}</p>
                `;

                const adminEmailBody = `
                    <p>Dear Admin,</p>
                    <p>A new external contact form has been submitted. The details are as follows:</p>
                    ${formattedMessage}
                    <br>
                    <p>Best regards,<br><b>NetSuite Automated Notification</b></p>
                `;

                email.send({
                    author: adminId,
                    recipients: adminId,
                    subject: `New External Form Submission - ${subject || 'No Subject'}`,
                    body: adminEmailBody
                });
                log.audit('Admin Email Sent', `To Admin ID = ${adminId}`);

                if (salesRepEmail) {
                    const salesRepEmailBody = `
                        <p>Dear Sales Representative,</p>
                        <p>A new customer has submitted an inquiry through the external contact form. The details are below:</p>
                        ${formattedMessage}
                        <br>
                        <p>Best regards,<br><b>NetSuite Automated Notification</b></p>
                    `;

                    email.send({
                        author: adminId,
                        recipients: salesRepEmail,
                        subject: `New Customer Submission - ${custName || 'Unnamed Customer'}`,
                        body: salesRepEmailBody
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

        return { afterSubmit }

    });
de3