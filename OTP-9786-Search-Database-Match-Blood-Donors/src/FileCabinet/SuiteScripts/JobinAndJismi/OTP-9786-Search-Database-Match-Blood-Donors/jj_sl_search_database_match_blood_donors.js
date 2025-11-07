/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log', 'N/runtime', 'N/search', 'N/ui/serverWidget'],
    /**
 * @param{log} log
 * @param{runtime} runtime
 * @param{search} search
 * @param{serverWidget} serverWidget
 */
    (log, runtime, search, serverWidget) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */

        const CUSTOM_RECORD_TYPE = 'customrecord_jj_blood_donor';
        const CLIENT_SCRIPT_PATH = './jj_cs_search_validate.js';

        function displayForm(scriptContext) {
            const form = serverWidget.createForm({
                title: 'Blood Donor Search'
            });

            form.clientScriptModulePath = CLIENT_SCRIPT_PATH;

            const bloodGroup = form.addField({
                id: 'custpage_blood_group',
                type: serverWidget.FieldType.SELECT,
                label: 'Blood Group'
            });
            bloodGroup.isMandatory = true;
            bloodGroup.addSelectOption({ value: '', text: 'Select Blood Group' });

            try {
                const bgSearch = search.create({
                    type: CUSTOM_RECORD_TYPE,
                    columns: [
                        search.createColumn({ 
                            name: 'custrecord_jj_blood_group', 
                            summary: 'GROUP' })
                    ],
                    filters: [
                        ['isinactive', 'is', 'F']
                    ]
                });

                bgSearch.run().each(function (result) {
                    const bgValue = result.getValue({ 
                        name: 'custrecord_jj_blood_group', 
                        summary: 'GROUP' });
                    const bgText = result.getText({ 
                        name: 'custrecord_jj_blood_group', 
                        summary: 'GROUP' });

                    if (bgValue) {
                        bloodGroup.addSelectOption({
                            value: bgValue,
                            text: bgText || bgValue
                        });
                    }
                    return true;
                });
            } 
            catch (e) {
                log.error('Dropdown Error', e.message);
            }

            const lastDonationDate = form.addField({
                id: 'custpage_last_donation_date',
                type: serverWidget.FieldType.DATE,
                label: 'Last Donation Date (Before)'
            });
            lastDonationDate.isMandatory = true;

            const params = scriptContext.request.parameters;
            const selectedBloodGroup = params.custpage_blood_group;
            const selectedDate = params.custpage_last_donation_date;

            if (selectedBloodGroup && selectedDate) {
                bloodGroup.defaultValue = selectedBloodGroup;
                lastDonationDate.defaultValue = selectedDate;

                try {
                    const donorSearch = search.create({
                        type: CUSTOM_RECORD_TYPE,
                        filters: [
                            ['custrecord_jj_blood_group', 'anyof', selectedBloodGroup],
                            'AND',
                            ['custrecord_jj_last_donation_date', 'onorbefore', selectedDate],
                            'AND',
                            ['isinactive', 'is', 'F']
                        ],
                        columns: [
                            'custrecord_jj_first_name',
                            'custrecord_jj_last_name',
                            'custrecord_jj_phone_number',
                            'custrecord_jj_blood_group',
                            'custrecord_jj_last_donation_date'
                        ]
                    });

                    const donors = [];
                    donorSearch.run().each(function (result) {
                        donors.push({
                            name: (result.getValue('custrecord_jj_first_name')) + ' ' +
                                (result.getValue('custrecord_jj_last_name')),
                            phone: result.getValue('custrecord_jj_phone_number'),
                            bloodGroup: result.getText('custrecord_jj_blood_group'),
                            lastDonation: result.getValue('custrecord_jj_last_donation_date')
                        });
                        return true;
                    });

                    log.audit('Search Results', 'Found ' + donors.length + ' donors(s)');

                    const resultMsg = form.addField({
                        id: 'custpage_result_msg',
                        type: serverWidget.FieldType.INLINEHTML,
                        label: ' '
                    });
                    resultMsg.defaultValue = '<b>Found ' + donors.length + ' eligible donor(s)</b>';

                    if (donors.length > 0) {
                        const sublist = form.addSublist({
                            id: 'custpage_donors',
                            type: serverWidget.SublistType.LIST,
                            label: 'Eligible Donors'
                        });

                        sublist.addField({ 
                            id: 'custpage_name', 
                            type: serverWidget.FieldType.TEXT, 
                            label: 'Name' 
                        });
                        sublist.addField({ 
                            id: 'custpage_phone', 
                            type: serverWidget.FieldType.PHONE, 
                            label: 'Phone Number' 
                        });
                        sublist.addField({ 
                            id: 'custpage_bloodgroup', 
                            type: serverWidget.FieldType.TEXT, 
                            label: 'Blood Group' 
                        });
                        sublist.addField({ 
                            id: 'custpage_lastdonation', 
                            type: serverWidget.FieldType.DATE, 
                            label: 'Last Donation Date' 
                        });

                        for (let i = 0; i < donors.length; i++) {
                            sublist.setSublistValue({ 
                                id: 'custpage_name', 
                                line: i, 
                                value: donors[i].name 
                            });
                            sublist.setSublistValue({ 
                                id: 'custpage_phone', 
                                line: i, 
                                value: donors[i].phone 
                            });
                            sublist.setSublistValue({ 
                                id: 'custpage_bloodgroup', 
                                line: i, 
                                value: donors[i].bloodGroup 
                            });
                            sublist.setSublistValue({ 
                                id: 'custpage_lastdonation', 
                                line: i, 
                                value: donors[i].lastDonation 
                            });
                        }
                    } 
                    else {
                        const noResultMsg = form.addField({
                            id: 'custpage_no_result',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: ' '
                        });
                        noResultMsg.defaultValue = '<p>No eligible donors found for selected criteria.</p>';
                    }
                } 
                catch (e) {
                    log.error('Search Error', e.message);
                }
            }

            form.addSubmitButton({ label: 'Search' });
            form.addResetButton({ label: 'Reset' });

            scriptContext.response.writePage(form);
        }

        const onRequest = (scriptContext) => {
            try {
                if (scriptContext.request.method === 'GET' || scriptContext.request.method === 'POST') {
                    displayForm(scriptContext);
                }
            } 
            catch (e) {
                log.error('Error Occurred', e.message);
            }
        }

        return { onRequest }

    });
