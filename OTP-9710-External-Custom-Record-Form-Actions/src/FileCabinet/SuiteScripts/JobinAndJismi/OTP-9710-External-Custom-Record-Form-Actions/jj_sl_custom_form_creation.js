/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/email', 'N/log', 'N/runtime'],
    /**
 * @param{serverWidget} serverWidget
 * @param{record} record
 * @param{search} search
 * @param{email} email
 * @param{log} log
 * @param{runtime} runtime
 */
    (serverWidget, record, search, email, log, runtime) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */

        function createContactForm() {
            try {
                const form = serverWidget.createForm({
                    title: 'External Customer Contact Form'
                });

                form.addField({
                    id: 'custpage_custname',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Customer Name'
                }).isMandatory = true;

                form.addField({
                    id: 'custpage_email',
                    type: serverWidget.FieldType.EMAIL,
                    label: 'Customer Email'
                }).isMandatory = true;

                form.addField({
                    id: 'custpage_subject',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Subject'
                }).isMandatory = true;

                form.addField({
                    id: 'custpage_message',
                    type: serverWidget.FieldType.LONGTEXT,
                    label: 'Message'
                }).isMandatory = true;

                form.addSubmitButton({ label: 'Submit' });
                return form;
            }
            catch (error) {
                log.error('Error in createContactForm', error);
                throw error;
            }
        }

        function getCustomerByEmail(custEmail) {
            try {
                const result = search.create({
                    type: search.Type.CUSTOMER,
                    filters: [['email', 'is', custEmail]],
                    columns: ['internalid']
                }).run().getRange({ start: 0, end: 1 });

                if (result.length > 0) {
                    return result[0].getValue('internalid');
                }
                return null;
            }
            catch (error) {
                log.error('Error in getCustomerByEmail', error);
                throw error;
            }
        }

        function createCustomRecord(custName, custEmail, subject, message, customerId) {
            try {
                const customRecord = record.create({
                    type: 'customrecord_jj_custom_customer_form',
                    isDynamic: true
                });

                customRecord.setValue({
                    fieldId: 'custrecord_jj_customer_name', value: custName
                });
                customRecord.setValue({
                    fieldId: 'custrecord_jj_customer_email', value: custEmail
                });
                customRecord.setValue({
                    fieldId: 'custrecord_jj_subject', value: subject
                });
                customRecord.setValue({
                    fieldId: 'custrecord_jj_message', value: message
                });

                if (customerId) {
                    customRecord.setValue({
                        fieldId: 'custrecord_jj_customer_reference',
                        value: customerId
                    });
                }

                const recordId = customRecord.save();
                return recordId;
            }
            catch (error) {
                log.error('Error in createCustomRecord', error);
                throw error;
            }
        }

        const onRequest = (scriptContext) => {
            try {
                if (scriptContext.request.method === 'GET') {
                    const form = createContactForm();
                    scriptContext.response.writePage(form);
                }
                else if (scriptContext.request.method === 'POST') {
                    const custName = scriptContext.request.parameters.custpage_custname;
                    const custEmail = scriptContext.request.parameters.custpage_email;
                    const subject = scriptContext.request.parameters.custpage_subject;
                    const message = scriptContext.request.parameters.custpage_message;

                    const customerId = getCustomerByEmail(custEmail);
                    const recordId = createCustomRecord(custName, custEmail, subject, message, customerId);

                    log.audit('Custom Record Created', 'ID: ' + recordId);

                    scriptContext.response.write(`
                        <h2>Thank you for your submission!</h2>
                        <p>Your message has been successfully submitted.</p>
                    `);
                }
            }
            catch (error) {
                log.error('Error in onRequest', error);
                scriptContext.response.write('<h2>Error:</h2><p>' + error.message + '</p>');
            }
        }

        return { onRequest }

    });
