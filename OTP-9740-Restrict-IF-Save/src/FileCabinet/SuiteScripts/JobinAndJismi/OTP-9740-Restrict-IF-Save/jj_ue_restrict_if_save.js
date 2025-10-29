/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/record', 'N/runtime', 'N/search'],
    /**
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 */
(log, record, runtime, search) => {

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


    function applyRestrictionLogic(execContext, soId, soTotal, depositTotal) {
        try {
            if (execContext === runtime.ContextType.USEREVENT) {
                if (depositTotal < soTotal) {
                    log.audit('Restriction Bypassed', 
                        `Bulk fulfillment detected for Sales Order ${soId}. Deposit less than Sales Order total, but restriction bypassed.`);
                } 
                else {
                    log.audit('Bulk Fulfillment Allowed', 
                        `Deposit sufficient for Sales Order ${soId}. Bulk fulfillment proceeding.`);
                }
            } 
            else {
                if (depositTotal < soTotal) {
                    throw `Cannot fulfill this Sales Order (${soId}). Total deposit (${depositTotal}) is less than the order total (${soTotal}).`;
                } 
                else {
                    log.debug('Validation Passed', 
                        `Deposit sufficient for Sales Order ${soId}. Single fulfillment allowed.`);
                }
            }
        } 
        catch (e) {
            throw e;
        }
    }

    function handleError(e) {
        throw e;
    }

    /*
     * Defines the function definition that is executed before record is submitted.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
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

    return { beforeSubmit };
});