/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

/************************************************************************************************ 
 *  
 * OTP-9615 : Create API for deleting the Item Fulfillment
 * 
*************************************************************************************************
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 24-October-2025 
 * 
 * Description : RESTlet script to delete Item Fulfillment records in NetSuite based on Sales Order details provided by external applications. 
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 24-October-2025 :  The initial build was created by JJ0419
 * 
*************************************************************************************************/ 

define(['N/log', 'N/record'],
    /**
 * @param{log} log
 * @param{record} record
 */
    (log, record) => {

        /**
         * Defines the function that is executed when a DELETE request is sent to a RESTlet.
         * @param {Object} requestParams - Parameters from HTTP request URL; parameters are passed as an Object (for all supported
         *     content types)
         * @returns {string | Object} HTTP response body; returns a string when request Content-Type is 'text/plain'; returns an
         *     Object when request Content-Type is 'application/json' or 'application/xml'
         * @since 2015.2
         */
        const doDelete = (requestParams) => {
            try {
                return deleteItemFulfillment(requestParams);
            }
            catch (error) {
                log.error({
                    title: 'Failed to process DELETE request',
                    details: error
                });
                return {
                    RESULT: "FAILED",
                    error: error.message
                };
            }
        }

        /**
         * Deletes an existing Item Fulfillment record from NetSuite based on the provided internal ID.
         *
         * @function deleteItemFulfillment
         * @param {Object} requestParams - The request object containing Item Fulfillment details.
         * @param {number|string} requestParams.itemFulfillmentId - The internal ID of the Item Fulfillment record to be deleted.
         * @returns {Object} Returns a result object containing the outcome of the deletion process.
         * @returns {string} return.RESULT - Indicates whether the operation succeeded or failed.
         * @returns {string} [return.error] - Error message if the deletion fails or record is not found.
         * @throws {Error} Throws and logs an error if an unexpected issue occurs during deletion.
         */
        function deleteItemFulfillment(requestParams) {
            try {
                if (!requestParams || !requestParams.itemFulfillmentId) {
                    return {
                        RESULT: "FAILED",
                        error: "Missing itemFulfillmentId in request body"
                    };
                }

                const fulfillmentId = requestParams.itemFulfillmentId;

                try {
                    const itemFulfillment = record.load({
                        type: record.Type.ITEM_FULFILLMENT,
                        id: fulfillmentId
                    });
                }
                catch (error) {
                    return {
                        RESULT: "FAILED",
                        error: "Item Fulfillment record not found"
                    };
                }

                record.delete({
                    type: record.Type.ITEM_FULFILLMENT,
                    id: fulfillmentId
                });

                log.audit({
                    title: 'Item Fulfillment Deleted',
                    details: `ID: ${fulfillmentId}`
                });

                return {
                    RESULT: "Item Fulfillment Deleted",
                    fulfillmentId: fulfillmentId
                };
            } 
            catch (error) {
                log.error({
                    title: 'Failed to delete Item Fulfillment',
                    details: error
                });
                return {
                    RESULT: "FAILED",
                    error: error.message
                };
            }
        }

        return { delete: doDelete }

    });
