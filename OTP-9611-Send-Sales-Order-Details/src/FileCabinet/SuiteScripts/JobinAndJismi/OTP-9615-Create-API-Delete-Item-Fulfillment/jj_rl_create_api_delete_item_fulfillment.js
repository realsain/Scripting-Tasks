/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
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

            } catch (error) {
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

        return { delete: doDelete }

    });
