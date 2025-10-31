/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

/************************************************************************************************ 
 *  
 * OTP-9613 : Create API for creating the Item Fulfillment
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 22-October-2025 
 * 
 * Description : RESTlet script to create Item Fulfillment records in NetSuite based on Sales Order details provided by external applications. 
 * 
*************************************************************************************************/ 

define(['N/log', 'N/record'],
    /**
 * @param{log} log
 * @param{record} record
 */
    (log, record) => {

        /**
         * Creates an Item Fulfillment record in NetSuite by transforming an existing Sales Order.
         *
         * @function createItemFulfillment
         * @param {Object} requestBody - The input request body containing sales order and item details.
         * @param {number|string} requestBody.salesOrderId - The internal ID of the Sales Order to be fulfilled.
         * @param {Array<Object>} [requestBody.items] - Array of item details for fulfillment.
         * @param {number|string} requestBody.items[].itemId - The internal ID of the item to fulfill.
         * @param {number} [requestBody.items[].quantity] - The quantity to fulfill for the item.
         * @param {number|string} [requestBody.items[].location] - The internal ID of the location for fulfillment.
         * @returns {Object} Returns a result object with success or failure details.
         * @throws {Error} Logs and returns an error if fulfillment creation fails.
         */
        function createItemFulfillment(requestBody) {
            try {
                if (!requestBody || !requestBody.salesOrderId) {
                    return {
                        RESULT: "FAILED", 
                        error: "Missing salesOrderId in request body" 
                    };
                }

                const salesOrderId = requestBody.salesOrderId;
                const itemsData = requestBody.items || [];

                const salesOrder = record.load({
                    type: record.Type.SALES_ORDER,
                    id: salesOrderId,
                    isDynamic: true
                });

                const itemFulfillment = record.transform({
                    fromType: record.Type.SALES_ORDER,
                    fromId: salesOrderId,
                    toType: record.Type.ITEM_FULFILLMENT,
                    isDynamic: true
                });

                const lineCount = itemFulfillment.getLineCount({ 
                    sublistId: 'item' 
                });

                for (let i = 0; i < lineCount; i++) {
                    itemFulfillment.selectLine({ sublistId: 'item', line: i });

                    const itemId = itemFulfillment.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item'
                    });

                    const itemObj = itemsData.find(it => it.itemId == itemId);
                    if (itemObj && itemObj.quantity) {
                        itemFulfillment.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: itemObj.quantity
                        });
                    }

                    if (itemObj.location) {
                        itemFulfillment.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'location',
                            value: itemObj.location
                        });
                    }

                    itemFulfillment.commitLine({ sublistId: 'item' });
                }

                const fulfillmentId = itemFulfillment.save();

                log.audit({
                    title: 'Item Fulfillment Created',
                    details: `ID: ${fulfillmentId}`
                });

                return {
                    RESULT: "Item Fulfillment Created",
                    fulfillmentId: fulfillmentId
                };

            } 
            catch (error) {
                log.error({
                    title: 'Failed to create Item Fulfillment',
                    details: error
                });

                return { 
                    RESULT: "FAILED", 
                    error: error.message 
                };
            }
        }

        /**
         * Defines the function that is executed when a POST request is sent to a RESTlet.
         * @param {string | Object} requestBody - The HTTP request body; request body is passed as a string when request
         *     Content-Type is 'text/plain' or parsed into an Object when request Content-Type is 'application/json' (in which case
         *     the body must be a valid JSON)
         * @returns {string | Object} HTTP response body; returns a string when request Content-Type is 'text/plain'; returns an
         *     Object when request Content-Type is 'application/json' or 'application/xml'
         * @since 2015.2
         */
        const post = (requestBody) => {
            try {
                return createItemFulfillment(requestBody);
            }
            catch (error) {
                log.error({
                    title: 'Failed to process POST request',
                    details: error
                });
                return { RESULT: "FAILED", error: error.message };
            }
        }

        return { post }

    });
