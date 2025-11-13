/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
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

define(['N/email', 'N/log', 'N/runtime', 'N/search'],
    /**
 * @param{email} email
 * @param{log} log
 * @param{runtime} runtime
 * @param{search} search
 */
    (email, log, runtime, search) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {
            try {
                sendLowStockReport();
                sendHighStockReport();
            }
            catch (e) {
                log.error({
                    title: 'Error executing Scheduled Script',
                    details: e.message
                });
            }
        }

        /**
         * Sends an email report listing all products with low stock levels (below 10 units).
         * @function sendLowStockReport
         * @description Searches for items with available quantity less than 10 and emails the report to the Inventory Manager.
         * @returns {void} Does not return a value; sends an email with the low stock report.
         * @throws {Error} Logs and throws an error if the search or email sending operation fails.
         */
        function sendLowStockReport() {
            try {
                const lowStockSearch = search.create({
                    type: 'item',
                    filters: [['quantityonhand', 'lessthan', '10']],
                    columns: ['internalid', 'itemid', 'quantityonhand']
                });

                let htmlBody = `
                    <p>Dear <b>Inventory Manager</b>,</p>
                    <p>The following items are currently <b>low in stock</b> and may require immediate replenishment:</p>
                    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">
                        <tr style="background-color:#f2f2f2;">
                            <th>Item ID</th>
                            <th>Item Name</th>
                            <th>Quantity on Hand</th>
                        </tr>
                `;

                let count = 0;
                lowStockSearch.run().each(result => {
                    htmlBody += `
                        <tr>
                            <td>${result.getValue('internalid')}</td>
                            <td>${result.getValue('itemid')}</td>
                            <td>${result.getValue('quantityonhand')}</td>
                        </tr>
                    `;
                    count++;
                    return true;
                });

                htmlBody += `</table>`;

                if (count === 0) {
                    htmlBody += `<p><i>No items currently fall below the low-stock threshold.</i></p>`;
                }

                htmlBody += `
                    <p>Kindly take the necessary action to restock the above products.</p>
                    <p>Best regards,<br>
                    <b>NetSuite Automated Stock Monitor</b><br>
                    <small>This is a system-generated email. Please do not reply.</small></p>
                `;

                email.send({
                    author: -5,
                    recipients: 'john.mathews@oracle.com',
                    subject: 'Low Stock Alert Report',
                    body: htmlBody
                });

                log.audit({
                    title: 'Low Stock Report Sent',
                    details: `Low stock email sent successfully to Inventory Manager. Total items: ${count}`
                });

            } 
            catch (error) {
                log.error({
                    title: 'Error Sending Low Stock Report',
                    details: error.message
                });
                throw error;
            }
        }

        /**
         * Sends an email report listing all products with high stock levels (above 500 units).
         * @function sendHighStockReport
         * @description Searches for items with available quantity greater than 500 and emails the report to the Purchasing Manager.
         * @returns {void} Does not return a value; sends an email with the high stock report.
         * @throws {Error} Logs and throws an error if the search or email sending operation fails.
         */
        function sendHighStockReport() {
            try {
                const highStockSearch = search.create({
                    type: 'item',
                    filters: [['quantityonhand', 'greaterthan', '500']],
                    columns: ['internalid', 'itemid', 'quantityonhand']
                });

                let htmlBody = `
                    <p>Dear <b>Purchasing Manager</b>,</p>
                    <p>The following items are currently <b>overstocked</b>. You may consider reviewing purchase or clearance strategies:</p>
                    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">
                        <tr style="background-color:#f2f2f2;">
                            <th>Item ID</th>
                            <th>Item Name</th>
                            <th>Quantity Available</th>
                        </tr>
                `;

                let count = 0;
                highStockSearch.run().each(result => {
                    htmlBody += `
                        <tr>
                            <td>${result.getValue('internalid')}</td>
                            <td>${result.getValue('itemid')}</td>
                            <td>${result.getValue('quantityonhand')}</td>
                        </tr>
                    `;
                    count++;
                    return true;
                });

                htmlBody += `</table>`;

                if (count === 0) {
                    htmlBody += `<p><i>No items currently exceed the high-stock threshold.</i></p>`;
                }

                htmlBody += `
                    <p>Kindly review the inventory levels and take appropriate action.</p>
                    <p>Warm regards,<br>
                    <b>NetSuite Automated Stock Monitor</b><br>
                    <small>This is an automated notification. Please do not reply.</small></p>
                `;

                email.send({
                    author: -5,
                    recipients: 'priya.dev@oracle.com',
                    subject: 'High Stock Alert Report',
                    body: htmlBody
                });

                log.audit({
                    title: 'High Stock Report Sent',
                    details: `High stock email sent successfully to Purchasing Manager. Total items: ${count}`
                });

            }
            catch (error) {
                log.error({
                    title: 'Error Sending High Stock Report',
                    details: error.message
                });
            }
        }

        return { execute }

    });
