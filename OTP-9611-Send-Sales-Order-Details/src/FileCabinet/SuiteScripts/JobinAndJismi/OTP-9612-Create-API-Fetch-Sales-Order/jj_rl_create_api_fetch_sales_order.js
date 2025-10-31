/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

/************************************************************************************************ 
 *  
 * OTP-9612 : Create API for the fetching the Sales order details
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 22-October-2025 
 * 
 * Description : RESTlet script to retrieve open and specific Sales Orders from NetSuite enabling external systems to securely access real-time sales order data.
 * 
*************************************************************************************************/ 

define(['N/log', 'N/record', 'N/search'],
    /**
 * @param{log} log
 * @param{record} record
 * @param{search} search
 */
    (log, record, search) => {

        /**
         * Retrieves all open Sales Orders from NetSuite based on defined statuses.
         * 
         * @function getOpenSalesOrders
         * @returns {Object[] | Object} Returns an array of open Sales Orders or an object with message "NOT FOUND" if none exist.
         * @throws {Error} Logs an error if the search operation fails.
         */
        function getOpenSalesOrders() {
            try {
                const salesOrderSearch = search.create({
                    type: search.Type.SALES_ORDER,
                    filters: [['status', 'anyof', ['SalesOrd:A', 'SalesOrd:B', 'SalesOrd:F']]],
                    columns: ['internalid', 'tranid', 'trandate', 'total']
                });

                const salesOrderResults = [];
                salesOrderSearch.run().each((results) => {
                    salesOrderResults.push({
                        internalId: results.getValue('internalid'),
                        documentNumber: results.getValue('tranid'),
                        date: results.getValue('trandate'),
                        totalAmount: results.getValue('total')
                    });
                    return true;
                });

                if (salesOrderResults.length === 0) {
                    return { RESULT: 'NOT FOUND' };
                }

                return salesOrderResults;
            }
            catch (error) {
                log.error({
                    error: 'Failed to fetch open sales orders',
                    details: error.message
                });
            }
        }

        /**
         * Retrieves detailed information of a single Sales Order, including item sublist data.
         * 
         * @function getSingleSalesOrder
         * @param {number|string} salesOrderId - The internal ID of the Sales Order to retrieve.
         * @returns {Object} Returns a Sales Order object with header and item details or a "NOT FOUND" message if not found.
         * @throws {Error} Logs an error if record loading or data extraction fails.
         */
        function getSingleSalesOrder(salesOrderId) {
            try {
                const salesOrderRecord = record.load({
                    type: record.Type.SALES_ORDER,
                    id: salesOrderId,
                    isDynamic: true
                });

                const itemCount = salesOrderRecord.getLineCount({
                    sublistId: 'item'
                });

                const items = [];

                for (let i = 0; i < itemCount; i++) {
                    items.push({
                        itemName: salesOrderRecord.getSublistText({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: i
                        }),
                        quantity: salesOrderRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            line: i
                        }),
                        rate: salesOrderRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            line: i
                        }),
                        grossAmount: salesOrderRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'amount',
                            line: i
                        })
                    });
                }

                return {
                    internalId: salesOrderRecord.id,
                    documentNumber: salesOrderRecord.getValue('tranid'),
                    date: salesOrderRecord.getValue('trandate'),
                    totalAmount: salesOrderRecord.getValue('total'),
                    items: items
                };

            }
            catch (error) {
                log.error({
                    error: 'Failed to fetch sales order with ID',
                    details: error.message
                });

                return { RESULT: 'NOT FOUND' };
            }
        }

        /**
         * Defines the function that is executed when a GET request is sent to a RESTlet.
         * @param {Object} requestParams - Parameters from HTTP request URL; parameters passed as an Object (for all supported
         *     content types)
         * @returns {string | Object} HTTP response body; returns a string when request Content-Type is 'text/plain'; returns an
         *     Object when request Content-Type is 'application/json' or 'application/xml'
         * @since 2015.2
         */
        const get = (requestParams) => {
            try {
                if (requestParams && requestParams.id) {
                    return getSingleSalesOrder(requestParams.id);
                }
                else {
                    return getOpenSalesOrders();
                }
            }
            catch (error) {
                return { error: `Unexpected error: ${error.message}` };
            }
        }

        return { get }

    });
