/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

/************************************************************************************************ 
 *  
 * OTP-9614 : Create API for updating the Item Fulfillment
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 23-October-2025 
 * 
 * Description : RESTlet script to update Item Fulfillment records in NetSuite based on Sales Order details provided by external applications. 
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 23-October-2025 :  The initial build was created by JJ0419
 * 
*************************************************************************************************/ 

define(['N/log', 'N/record', 'N/format'],
    /**
 * @param{log} log
 * @param{record} record
 * @param{format} format
 */
    (log, record, format) => {

        /**
         * Updates an existing Item Fulfillment record in NetSuite with provided field values.
         *
         * @function updateItemFulfillment
         * @param {Object} requestBody - The request body containing update data.
         * @param {number|string} requestBody.itemFulfillmentId - The internal ID of the Item Fulfillment record to update.
         * @param {string} [requestBody.trandate] - The transaction date in 'YYYY-MM-DD' format.
         * @param {number|string} [requestBody.postingPeriod] - The internal ID of the posting period to set.
         * @param {string} [requestBody.memo] - Optional memo or note for the record.
         * @returns {Object} Returns a result object with update status and record ID.
         * @throws {Error} Throws and logs an error if the record update fails.
         */
        function updateItemFulfillment(requestBody) {
            try {
                if (!requestBody || !requestBody.itemFulfillmentId) {
                    return {
                        RESULT: "FAILED",
                        error: "Missing itemFulfillmentId in request body"
                    };
                }

                const fulfillmentId = requestBody.itemFulfillmentId;

                const itemFulfillment = record.load({
                    type: record.Type.ITEM_FULFILLMENT,
                    id: fulfillmentId,
                    isDynamic: true
                });

                if (requestBody.trandate) {
                    const formattedDate = format.parse({
                        value: requestBody.trandate,
                        type: format.Type.DATE
                    });
                    itemFulfillment.setValue({
                        fieldId: 'trandate',
                        value: formattedDate
                    });
                }
                if (requestBody.postingPeriod) {
                    itemFulfillment.setValue({
                        fieldId: 'postingperiod',
                        value: requestBody.postingPeriod
                    });
                }
                if (requestBody.memo) {
                    itemFulfillment.setValue({
                        fieldId: 'memo',
                        value: requestBody.memo
                    });
                }

                const updatedId = itemFulfillment.save();
                log.audit({
                    title: 'Item Fulfillment Updated',
                    details: `ID: ${updatedId}`
                });

                return {
                    RESULT: "Item Fulfillment Updated",
                    fulfillmentId: updatedId
                };
            }
            catch (error) {
                log.error({
                    title: 'Failed to update Item Fulfillment',
                    details: error.message
                });
                return {
                    RESULT: "FAILED",
                    error: error.message
                };
            }
        }

        /**
         * Defines the function that is executed when a PUT request is sent to a RESTlet.
         * @param {string | Object} requestBody - The HTTP request body; request body are passed as a string when request
         *     Content-Type is 'text/plain' or parsed into an Object when request Content-Type is 'application/json' (in which case
         *     the body must be a valid JSON)
         * @returns {string | Object} HTTP response body; returns a string when request Content-Type is 'text/plain'; returns an
         *     Object when request Content-Type is 'application/json' or 'application/xml'
         * @since 2015.2
         */
        const put = (requestBody) => {
            try {
                return updateItemFulfillment(requestBody);
            }
            catch (error) {
                log.error({
                    title: 'Failed to process PUT request',
                    details: error
                });
                return {
                    RESULT: "FAILED",
                    error: error.message
                };
            }
        }

        return { put }

    });
