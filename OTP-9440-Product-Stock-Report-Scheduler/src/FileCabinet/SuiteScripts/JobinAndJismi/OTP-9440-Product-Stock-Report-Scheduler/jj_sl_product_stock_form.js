/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/************************************************************************************************
*
* OTP-9440 : Product Stock Filter Suitelet and Report Scheduler
*
*************************************************************************************************
*
* Author: Jobin and Jismi IT Services
*
* Date Created : 13-November-2025
*
* Description : Suitelet displays a product filter form for low/high stock levels and stores the selected items in a custom record. A scheduled script sends daily low/high stock reports to inventory and purchasing managers.
*
* REVISION HISTORY
*
* @version 1.0 : 13-November-2025 : The initial build was created by JJ0419
*
*************************************************************************************************/

define(['N/search', 'N/ui/serverWidget', 'N/record', 'N/runtime', 'N/email', 'N/log', 'N/format'],
    /**
 * @param{search} search
 * @param{serverWidget} serverWidget
 * @param{record} record
 * @param{runtime} runtime
 * @param{email} email
 * @param{log} log
 * @param{format} format
 */
    (search, serverWidget, record, runtime, email, log, format) => {
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
                    displayForm(scriptContext);
                } 
                else {
                    const action = scriptContext.request.parameters.custpage_action;

                    if (action === 'search') {
                        displayForm(scriptContext, true);
                    } 
                    else {
                        processForm(scriptContext);
                    }
                }
            } 
            catch (err) {
                log.error('Error in Suitelet', err);
                scriptContext.response.write(`<script>alert("Error: ${err.message.replace(/"/g, '\\"')}");history.back();</script>`);
            }
        }

        /**
         * Creates and displays the Suitelet form for product filtering.
         * 
         * @function displayForm
         * @param {Object} scriptContext - The Suitelet context.
         * @description Renders a form with fields for Start Date, End Date, and Stock filters (Low or High Stock).
         * @returns {void} Displays a NetSuite form to the user.
         * @throws {Error} Logs and throws an error if the form rendering process fails.
         */
        function displayForm(scriptContext, showResults = false) {
            try {
                const request = scriptContext.request;
                const form = serverWidget.createForm({ title: 'Product Stock Filter' });

                const startDate = form.addField({
                    id: 'custpage_start_date',
                    type: serverWidget.FieldType.DATE,
                    label: 'Start Date'
                });
                const endDate = form.addField({
                    id: 'custpage_end_date',
                    type: serverWidget.FieldType.DATE,
                    label: 'End Date'
                });
                startDate.isMandatory = false;
                endDate.isMandatory = false;
                startDate.setHelpText({ help: 'Select the beginning of the date range for the product search.' });
                endDate.setHelpText({ help: 'Select the ending date for the product search.' });

                const lowStock = form.addField({
                    id: 'custpage_low_stock',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'Low Stock Products'
                });
                const highStock = form.addField({
                    id: 'custpage_high_stock',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'High Stock Products'
                });
                lowStock.setHelpText({ help: 'Show only products with stock below 10 units.' });
                highStock.setHelpText({ help: 'Show only products with stock above 500 units.' });

                const sublist = form.addSublist({
                    id: 'custpage_product_list',
                    type: serverWidget.SublistType.LIST,
                    label: 'Product List'
                });

                sublist.addMarkAllButtons();
                sublist.addField({ id: 'select', type: serverWidget.FieldType.CHECKBOX, label: 'Select' });
                sublist.addField({ id: 'productid', type: serverWidget.FieldType.TEXT, label: 'Internal ID' });
                sublist.addField({ id: 'productname', type: serverWidget.FieldType.TEXT, label: 'Product Name' });
                sublist.addField({ id: 'stocklevel', type: serverWidget.FieldType.INTEGER, label: 'Stock Level' });
                sublist.addField({ id: 'lastpurchasedate', type: serverWidget.FieldType.DATE, label: 'Last Purchase Date' });

                form.addSubmitButton({ label: 'Submit' });
                form.addResetButton({ label: 'Reset' });

                form.addButton({
                    id: 'custpage_search',
                    label: 'Search Products',
                    functionName: "document.forms[0].custpage_action.value='search';document.forms[0].submit();"
                });

                form.addField({
                    id: 'custpage_action',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Action'
                }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

                if (showResults) {
                    const startDateVal = request.parameters.custpage_start_date;
                    const endDateVal = request.parameters.custpage_end_date;
                    const isLowStock = request.parameters.custpage_low_stock === 'T';
                    const isHighStock = request.parameters.custpage_high_stock === 'T';

                    if (isLowStock && isHighStock) {
                        scriptContext.response.write(`<script>alert('Please select only one filter: Low Stock or High Stock.');history.back();</script>`);
                        return;
                    }

                    if (!isLowStock && !isHighStock) {
                        scriptContext.response.write(`<script>alert('Please select either Low Stock or High Stock filter.');history.back();</script>`);
                        return;
                    }

                    if (!startDateVal || !endDateVal) {
                        scriptContext.response.write(`<script>alert('Please fill both Start Date and End Date before searching.');history.back();</script>`);
                        return;
                    }

                    let searchfilters = '';
                    if (isLowStock) {
                        searchfilters = [
                            ['created', 'onorafter', startDateVal],
                            'AND',
                            ['created', 'onorbefore', endDateVal],
                            'AND',
                            ['quantityonhand', 'lessthan', '10']
                        ];
                    }
                    else if (isHighStock) {
                        searchfilters = [
                            ['created', 'onorafter', startDateVal],
                            'AND',
                            ['created', 'onorbefore', endDateVal],
                            'AND',
                            ['quantityonhand', 'greaterthan', '500']
                        ];
                    }

                    log.debug('Date', `Start date: ${startDateVal}, End Date: ${endDateVal}`);
                    log.debug('Status', `Is Low Stock: ${isLowStock}, Is High Stock: ${isHighStock}`);

                    const productSearch = search.create({
                        type: 'item',
                        filters: searchfilters,
                        columns: ['internalid', 'itemid', 'quantityonhand']
                    });

                    let line = 0;
                    productSearch.run().each(result => {
                        const productId = (result.getValue('internalid') || '').toString();
                        const productName = (result.getValue('itemid') || '').toString();
                        const stockLevel = ((result.getValue('quantityonhand') || '0')).toString();

                        log.debug('Result values', `ID: ${productId}, Name: ${productName}, Stock: ${stockLevel}`);

                        if (!productId || !productName) {
                            return true;
                        }

                        let formattedDate = '';
                        try {
                            const today = new Date();
                            formattedDate = format.format({ value: today, type: format.Type.DATE }) || '';
                        } 
                        catch (e) {
                            formattedDate = '';
                        }

                        sublist.setSublistValue({ id: 'productid', line: line, value: (result.getValue('internalid') || '').toString() });
                        sublist.setSublistValue({ id: 'productname', line: line, value: (result.getValue('itemid') || '').toString() });
                        sublist.setSublistValue({ id: 'stocklevel', line: line, value: (result.getValue('quantityonhand') || '0').toString() });
                        sublist.setSublistValue({ id: 'lastpurchasedate', line: line, value: format.format({ value: new Date(), type: format.Type.DATE }) });

                        line++;
                        return true;
                    });
                }

                scriptContext.response.writePage(form);

            } 
            catch (error) {
                log.error('Error Displaying Form', error);
                scriptContext.response.write(`<script>alert("Error: ${String(error.message).replace(/"/g, '\\"')}");history.back();</script>`);
            }
        }



        /**
         * Handles form submission and saves selected product data into a custom record.
         * 
         * @function processForm
         * @param {Object} scriptContext - The Suitelet context.
         * @description Processes the submitted form, validates stock filters, and saves product details to a custom record.
         * @returns {void} Creates a record for each selected product with relevant stock details.
         * @throws {Error} Logs and throws an error if validation, data extraction, or record creation fails.
         */
        function processForm(scriptContext) {
            try {
                const request = scriptContext.request;
                const lineCount = request.getLineCount({ group: 'custpage_product_list' });
                const employeeId = runtime.getCurrentUser().id;

                for (let i = 0; i < lineCount; i++) {
                    const isSelected = request.getSublistValue({ group: 'custpage_product_list', name: 'select', line: i });
                    if (isSelected === 'T') {
                        const productId = request.getSublistValue({ group: 'custpage_product_list', name: 'productid', line: i });
                        const stockLevel = request.getSublistValue({ group: 'custpage_product_list', name: 'stocklevel', line: i });
                        let lastPurchaseDate = request.getSublistValue({
                            group: 'custpage_product_list',
                            name: 'lastpurchasedate',
                            line: i
                        });

                        if (lastPurchaseDate) {
                            lastPurchaseDate = new Date(lastPurchaseDate);
                        }

                        const isHighStock = Number(stockLevel) > 500;

                        const customRecord = record.create({ type: 'customrecord_jj_product_stock_submission' });
                        customRecord.setValue('custrecord_jj_submitted_by', employeeId);
                        customRecord.setValue('custrecord_jj_product_id', productId);
                        customRecord.setValue('custrecord_jj_stock_level', stockLevel);
                        customRecord.setValue('custrecord_jj_last_purchase_date', lastPurchaseDate);
                        customRecord.setValue('custrecord_jj_product_status', isHighStock);
                        customRecord.save();
                    }
                }

                scriptContext.response.write(`<script>alert('Form submitted successfully!');</script>`);

            } 
            catch (error) {
                log.error('Error Processing Form Submission', error);
                scriptContext.response.write(`<script>alert("Error: ${error.message.replace(/"/g, '\\"')}");history.back();</script>`);
            }
        }

        return { onRequest }

    });
