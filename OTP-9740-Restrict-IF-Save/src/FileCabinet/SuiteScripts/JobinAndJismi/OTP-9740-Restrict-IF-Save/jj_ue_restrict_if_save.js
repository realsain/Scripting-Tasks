/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/************************************************************************************************ 
 *  
 * OTP-9740 : Restrict IF save
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 29-October-2025 
 * 
 * Description : UserEvent script restricts individual Item Fulfillment creation when customer deposits are less than the Sales Order total, while intelligently bypassing the restriction during bulk fulfillments.
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 29-October-2025 : The initial build was created by JJ0419
 * 
*************************************************************************************************/ 

define(['N/log', 'N/record', 'N/runtime', 'N/search'],
/**
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 */
(log, record, runtime, search) => {

    /**
     * Executes before a record is submitted to validate deposit coverage for linked Sales Orders.
     * Restricts fulfillment if deposit total is less than the Sales Order total.
     *
     * @param {Object} scriptContext - Context information about the triggering record event.
     * @param {Record} scriptContext.newRecord - The new record being created or edited.
     * @param {Record} scriptContext.oldRecord - The previous version of the record.
     * @param {string} scriptContext.type - Type of operation (CREATE, EDIT, DELETE, etc.).
     * @since 2015.2
     */
    const beforeSubmit = (scriptContext) => {
        try {
            if (scriptContext.type !== scriptContext.UserEventType.CREATE) {
                log.debug('Exit', 'Not a Create operation.');
                return;
            }

            const newRec = scriptContext.newRecord;
            const execContext = runtime.executionContext;
            const soId = newRec.getValue('createdfrom');

            if (!soId) {
                log.debug('Skip', 'No Sales Order linked.');
                return;
            }

            const { soTotal, depositTotal } = getSalesOrderAndDepositTotals(soId);

            log.debug({
                title: 'Deposit Validation',
                details: `Sales Order ID: ${soId} | Sales Order Total: ${soTotal} | Deposit Total: ${depositTotal}`
            });

            applyRestrictionLogic(execContext, soId, soTotal, depositTotal);

        } 
        catch (e) {
            handleError(e);
        }
    };

    /**
     * Retrieves the total amount from a Sales Order and all associated Customer Deposits.
     *
     * @param {number|string} soId - Internal ID of the Sales Order.
     * @returns {{soTotal: number, depositTotal: number}} Object containing the Sales Order total and the sum of related deposits.
     * @throws {Error} If record loading or search execution fails.
     */
    function getSalesOrderAndDepositTotals(soId) {
        try {
            const soRec = record.load({
                type: record.Type.SALES_ORDER,
                id: soId,
                isDynamic: false
            });
            const soTotal = parseFloat(soRec.getValue('total')) || 0;

            let depositTotal = 0;
            const depositSearch = search.create({
                type: 'customerdeposit',
                filters: [['salesorder', 'anyof', soId]],
                columns: ['total']
            });
            depositSearch.run().each(result => {
                depositTotal += parseFloat(result.getValue('total')) || 0;
                return true;
            });

            return { soTotal, depositTotal };
        } 
        catch (e) {
            throw e;
        }
    }

    /**
     * Applies restriction logic based on the execution context and deposit coverage.
     * - If executed as a User Event, logs audit information without blocking.
     * - If executed via other contexts, throws an error if deposit < Sales Order total.
     *
     * @param {string} execContext - Runtime context type (UserEvent, Suitelet, etc.).
     * @param {number|string} soId - Internal ID of the Sales Order.
     * @param {number} soTotal - Total amount of the Sales Order.
     * @param {number} depositTotal - Total of related Customer Deposits.
     * @returns {void}
     * @throws {string} Error message if restriction conditions are not met.
     */
    function applyRestrictionLogic(execContext, soId, soTotal, depositTotal) {
        try {
            if (execContext === runtime.ContextType.USEREVENT) {
                if (depositTotal < soTotal) {
                    log.audit('Restriction Bypassed', `Bulk fulfillment detected for Sales Order ${soId}. Deposit less than Sales Order total, but restriction bypassed.`);
                } 
                else {
                    log.audit('Bulk Fulfillment Allowed', `Deposit sufficient for Sales Order ${soId}. Bulk fulfillment proceeding.`);
                }
            } 
            else {
                if (depositTotal < soTotal) {
                    throw `Cannot fulfill this Sales Order (${soId}). Total deposit (${depositTotal}) is less than the order total (${soTotal}).`;
                } 
                else {
                    log.debug('Validation Passed', `Deposit sufficient for Sales Order ${soId}. Single fulfillment allowed.`);
                }
            }
        } 
        catch (e) {
            throw e;
        }
    }

    /**
     * Centralized error handler for logging or rethrowing exceptions.
     *
     * @param {Error|string} e - The caught error or exception message.
     * @throws {Error|string} Re-throws the provided error for higher-level handling.
     */
    function handleError(e) {
        throw e;
    }

    return { beforeSubmit };
});