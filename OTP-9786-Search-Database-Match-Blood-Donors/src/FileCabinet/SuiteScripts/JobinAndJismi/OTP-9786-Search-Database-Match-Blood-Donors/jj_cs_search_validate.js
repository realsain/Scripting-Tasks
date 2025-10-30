/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/ui/dialog'],
/**
 * @param{log} log
 * @param{dialog} dialog
 */
function(log, dialog) {

    function validateDate(donationDate) {
        var today = new Date();
        today.setHours(0, 0, 0, 0);

        var selectedDate = new Date(donationDate);
        selectedDate.setHours(0, 0, 0, 0);

        if (selectedDate > today) {
            return { valid: false, message: 'Date cannot be in the future.' };
        }

        var diffDays = Math.floor((today - selectedDate) / (1000 * 60 * 60 * 24));

        if (diffDays < 90) {
            return {
                valid: false,
                message: 'Date must be at least 90 days ago.\nDays entered: ' + diffDays + ' days.'
            };
        }

        return { valid: true };
    }

    /**
     * Validation function to be executed when record is saved.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @returns {boolean} Return true if record is valid
     *
     * @since 2015.2
     */
    function saveRecord(scriptContext) {
        try {
            var rec = scriptContext.currentRecord;

            var bloodGroup = rec.getValue({ fieldId: 'custpage_blood_group' });
            var lastDonationDate = rec.getValue({ fieldId: 'custpage_last_donation_date' });

            var missingFields = [];

            if (!bloodGroup) {
                missingFields.push('Blood Group');
            }

            if (!lastDonationDate) {
                missingFields.push('Last Donation Date');
            }

            if (missingFields.length > 0) {
                dialog.alert({
                    title: 'Missing Information',
                    message: 'Please enter: ' + missingFields.join(' and ')
                });
                return false;
            }

            var validation = validateDate(lastDonationDate);
            if (!validation.valid) {
                dialog.alert({
                    title: 'Validation Error',
                    message: validation.message
                });
                return false;
            }

            return true;
        }
        catch (e) {
            log.error({
                title: 'Error in saveRecord',
                details: e
            });
            return false;
        }
    }

    return {
        saveRecord: saveRecord
    };
    
});
