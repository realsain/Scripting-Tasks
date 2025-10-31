/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/************************************************************************************************ 
 *  
 * OTP-9785 : Custom form to store blood donor details and track them in database
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 29-October-2025 
 * 
 * Description : Suitelet script automate donor data collection through a dynamic Blood Donor Registration Form with validation and record creation.
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 29-October-2025 :  The initial build was created by JJ0419
 * 
*************************************************************************************************/

define(['N/log', 'N/record', 'N/runtime', 'N/ui/serverWidget'],
/**
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 * @param{serverWidget} serverWidget
 */
    (log, record, runtime, serverWidget) => {

        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            try {
                if (scriptContext.request.method === 'GET') {
                    displayDonorForm(scriptContext);
                }
                else if (scriptContext.request.method === 'POST') {
                    processDonorSubmission(scriptContext);
                }
            }
            catch (error) {
                log.error('Unexpected Error in onRequest', error);
                scriptContext.response.write(`Unexpected error occurred: ${error.message}`);
            }
        }

        /**
         * Displays the Blood Donor Registration Suitelet form.
         *
         * @param {Object} scriptContext - The Suitelet script context.
         * @param {ServerRequest} scriptContext.request - The incoming request object.
         * @param {ServerResponse} scriptContext.response - The outgoing response object.
         * @throws {Error} Logs and writes an error message if form creation fails.
         * @since 2025.1
         */
        function displayDonorForm(scriptContext) {
            try {
                const form = serverWidget.createForm({
                    title: 'Blood Donor Registration Form'
                });

                form.addField({
                    id: 'custpage_firstname',
                    type: serverWidget.FieldType.TEXT,
                    label: 'First Name'
                }).isMandatory = true;

                form.addField({
                    id: 'custpage_lastname',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Last Name'
                }).isMandatory = true;

                const genderField = form.addField({
                    id: 'custpage_gender',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Gender'
                });

                genderField.addSelectOption({
                    value: '1',
                    text: 'Male'
                });
                genderField.addSelectOption({
                    value: '2',
                    text: 'Female'
                });
                genderField.addSelectOption({
                    value: '3',
                    text: 'Other'
                });
                genderField.isMandatory = true;

                const bloodGroupField = form.addField({
                    id: 'custpage_bloodgroup',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Blood Group'
                });

                bloodGroupField.addSelectOption({
                    value: '1',
                    text: 'A+'
                });
                bloodGroupField.addSelectOption({
                    value: '2',
                    text: 'A-'
                });
                bloodGroupField.addSelectOption({
                    value: '3',
                    text: 'B+'
                });
                bloodGroupField.addSelectOption({
                    value: '4',
                    text: 'B-'
                });
                bloodGroupField.addSelectOption({
                    value: '5',
                    text: 'AB+'
                });
                bloodGroupField.addSelectOption({
                    value: '6',
                    text: 'AB-'
                });
                bloodGroupField.addSelectOption({
                    value: '7',
                    text: 'O+'
                });
                bloodGroupField.addSelectOption({
                    value: '8',
                    text: 'O-'
                });
                bloodGroupField.isMandatory = true;

                form.addField({
                    id: 'custpage_phone',
                    type: serverWidget.FieldType.PHONE,
                    label: 'Phone Number'
                }).isMandatory = true;

                form.addField({
                    id: 'custpage_lastdonation',
                    type: serverWidget.FieldType.DATE,
                    label: 'Last Donation Date'
                });

                form.addSubmitButton({
                    label: 'Submit Donor Details'
                });

                scriptContext.response.writePage(form);
            }
            catch (error) {
                log.error('Error Displaying Donor Form', error);
                scriptContext.response.write(`Error displaying form: ${error.message}`);
            }
        }

        /**
         * Processes the donor form submission and saves the data as a custom record.
         *
         * @param {Object} scriptContext - The Suitelet script context.
         * @param {ServerRequest} scriptContext.request - The POST request object containing submitted form data.
         * @param {ServerResponse} scriptContext.response - The response object for displaying the success or error message.
         * @throws {Error} Logs and writes an error message if record creation fails.
         * @since 2025.1
         */
        function processDonorSubmission(scriptContext) {
            try {
                const params = scriptContext.request.parameters;
                const currentUser = runtime.getCurrentUser();

                if (!params.custpage_firstname || !params.custpage_bloodgroup || !params.custpage_phone) {
                    throw Error('Please fill all mandatory fields: First Name, Phone Number, and Blood Group.');
                }

                const donorRecord = record.create({
                    type: 'customrecord_jj_blood_donor',
                    isDynamic: true
                });

                donorRecord.setValue('custrecord_jj_first_name', params.custpage_firstname);
                donorRecord.setValue('custrecord_jj_last_name', params.custpage_lastname);
                donorRecord.setValue('custrecord_jj_gender', params.custpage_gender);
                donorRecord.setValue('custrecord_jj_phone_number', params.custpage_phone);
                donorRecord.setValue('custrecord_jj_blood_group', params.custpage_bloodgroup);

                if (params.custpage_lastdonation) {
                    const formattedDate = new Date(params.custpage_lastdonation);
                    donorRecord.setValue('custrecord_jj_last_donation_date', formattedDate);
                }


                const recordId = donorRecord.save();

                log.audit({
                    title: 'Blood Donor Record Created',
                    details: `Record ID: ${recordId}, Created by ${currentUser.name} (ID: ${currentUser.id})`
                });

                const form = serverWidget.createForm({ title: 'Blood Donor Registration Success' });
                form.addField({
                    id: 'custpage_success',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: ' '
                }).defaultValue = `Donor registered successfully! (Record ID: ${recordId})`;
                scriptContext.response.writePage(form);

            }
            catch (error) {
                log.error('Error Submitting Donor Form', error);
                scriptContext.response.write(`Error saving donor record: ${error.message}`);
            }
        }

        return { onRequest }

    });
