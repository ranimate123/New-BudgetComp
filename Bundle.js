import { LightningElement, api, track, wire } from 'lwc';
import saveBudget from '@salesforce/apex/BudgetController.saveBudget';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import PROJECT_COST_FIELD from '@salesforce/schema/Project__c.Project_Cost__c';
import getDefaultBudget from '@salesforce/apex/BudgetController.getDefaultBudget';


export default class MarketingBudgetModal extends LightningElement {
    @api recordId;
    @track isModalOpen = false;
    @track projectCost = 0;
    @track marketingPercent = 0;
    @track marketingAmount = 0;
    @track cpPercent = 0;
    @track cpAmount = 0;
    @track otherPercent = 0;
    @track otherAmount = 0;
    @track numberOfYears = 1;
    @track yearTables = [];
    @track isEditMode = false;




    openModal() {
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
        this.numberOfYears = 1;
    }

    connectedCallback() {

    // if (this.recordId && this.recordId.startsWith('a1j')) { // Budget__c Id
    //     this.isEditMode = true;
    //     this.loadExistingBudget();
    //     return;
    // }

    getDefaultBudget()
        .then(result => {
            this.marketingPercent = result.Marketing_Expense_Budget_Percentage__c || 0;
            this.cpPercent = result.CP_Expense_Budget_Percantage__c || 0;
            this.otherPercent = result.Other_Expense_Marketing_Budget_Percentag__c || 0;

            if (this.projectCost) {
                this.calculateAmounts();
            }
        })
        .catch(error => {
            console.error('Error fetching default budget', error);
        });
}


    @wire(getRecord, { recordId: '$recordId', fields: [PROJECT_COST_FIELD] })
    wiredProject({ error, data }) {
        if (data) {
            this.projectCost = getFieldValue(data, PROJECT_COST_FIELD) || 0;
            this.calculateAmounts();
        } else if (error) {
            console.error('Error fetching project cost', error);
        }
    }

    calculateAmounts() {
        this.marketingAmount = (((this.projectCost * this.marketingPercent) / 100).toFixed(2));
        this.cpAmount = (((this.marketingAmount * this.cpPercent) / 100).toFixed(2));
        this.otherAmount = (((this.marketingAmount * this.otherPercent) / 100).toFixed(2));
        if (this.numberOfYears > 0) {
            this.generateYearTables();
        }
    }
    

    handleChange(event) {
    const group = event.target.dataset.group;
    const type = event.target.dataset.type;
    const value = Number(event.target.value) || 0;

    if (group === 'marketing') {
        if (type === 'percent') {
            this.marketingPercent = parseFloat(value.toFixed(2));
        } else {
            this.marketingAmount = parseFloat(value.toFixed(2));
            this.marketingPercent = parseFloat(((value / this.projectCost) * 100).toFixed(2));
        }
    }

    if (group === 'cp') {
        if (type === 'percent') {
            this.cpPercent = parseFloat(value.toFixed(2));
        } else {
            this.cpAmount = parseFloat(value.toFixed(2));
            this.cpPercent = parseFloat(((value / this.marketingAmount) * 100).toFixed(2));
        }
    }

    if (group === 'other') {
        if (type === 'percent') {
            this.otherPercent = parseFloat(value.toFixed(2));
        } else {
            this.otherAmount = parseFloat(value.toFixed(2));
            this.otherPercent = parseFloat(((value / this.marketingAmount) * 100).toFixed(2));
        }
    }

    this.calculateAmounts();
}


    get plannedBudget() {
        return this.marketingAmount - this.cpAmount - this.otherAmount;
    }

    saveBudgetRecord() {
    const planned = this.plannedBudget;

    const totalYearAmount = this.yearTables.reduce((sum, y) => sum + (y.totalBudget || 0), 0);
    if (parseFloat(totalYearAmount.toFixed(2)) !== parseFloat(planned.toFixed(2))) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Validation Error',
                message: `Sum of all year totals (${totalYearAmount.toFixed(
                    2
                )}) must exactly equal the Planned Budget (${planned.toFixed(2)}).`,
                variant: 'error',
                mode: 'dismissable'
            })
        );
        return;
    }

    for (let y of this.yearTables) {
        const quarterSum = y.quarters.reduce((sum, q) => sum + (q.amount || 0), 0);
        if (parseFloat(quarterSum.toFixed(2)) !== parseFloat((y.totalBudget || 0).toFixed(2))) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Validation Error',
                    message: `Sum of quarters for Year ${y.year} (${quarterSum.toFixed(
                        2
                    )}) must equal that year's planned budget (${y.totalBudget.toFixed(2)}).`,
                    variant: 'error',
                    mode: 'dismissable'
                })
            );
            return;
        }
    }

    saveBudget({
        projectId: this.recordId,
        marketingPercent: this.marketingPercent,
        marketingAmount: this.marketingAmount,
        cpPercent: this.cpPercent,
        cpAmount: this.cpAmount,
        otherPercent: this.otherPercent,
        otherAmount: this.otherAmount,
        yearDistributions: JSON.stringify(this.yearTables)
    })
        .then(result => {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Budget record created successfully',
                    variant: 'success'
                })
            );
            this.closeModal();
        })
        .catch(error => {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error creating budget record',
                    message: error.body ? error.body.message : error.message,
                    variant: 'error'
                })
            );
        });
}


handleYearsChange(event) {
    const value = Number(event.target.value) || 0;
    this.numberOfYears = value;

    if (value === 0) {
        this.yearTables = [];
        return;
    }

    this.generateYearTables();
}


generateYearTables() {
    const tables = [];

    for (let i = 1; i <= this.numberOfYears; i++) {
        tables.push({
            year: i,
            percent: 0,
            totalBudget: 0,
            leadTarget: 0,
            isQuarterManuallyEdited: false,

            quarters: [
                { label: `Y${i}Q1`, amount: 0 },
                { label: `Y${i}Q2`, amount: 0 },
                { label: `Y${i}Q3`, amount: 0 },
                { label: `Y${i}Q4`, amount: 0 }
            ]
        });
    }

    this.yearTables = tables;
}


handleQuarterChange(event) {
    const year = Number(event.target.dataset.year);
    const quarterLabel = event.target.dataset.quarter;
    const newAmount = Number(event.target.value) || 0;

    let showToast = false;
    let toastMessage = '';

    this.yearTables = this.yearTables.map(y => {
        if (y.year === year) {
            const updatedQuarters = y.quarters.map(q =>
                q.label === quarterLabel ? { ...q, amount: parseFloat(newAmount.toFixed(2)) } : q
            );

            const totalOfQuarters = updatedQuarters.reduce((sum, q) => sum + (q.amount || 0), 0);
            const totalBudget = y.totalBudget || 0;

            const warningNeeded = totalBudget > 0 && parseFloat(totalOfQuarters.toFixed(2)) !== parseFloat(totalBudget.toFixed(2));

            if (warningNeeded && !y.warningShown) {
                showToast = true;
                toastMessage = `Sum of quarters (${totalOfQuarters.toFixed(2)}) does not match the planned budget (${totalBudget.toFixed(2)}) for Year ${year}.`;
            }

            return {
                ...y,
                quarters: updatedQuarters,
                isQuarterManuallyEdited: true,
                warningShown: warningNeeded
            };
        }
        return y;
    });

    if (showToast) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Validation Warning',
                message: toastMessage,
                variant: 'Error',
                mode: 'dismissable'
            })
        );
    }
}




handleYearTotalChange(event) {
    const year = Number(event.target.dataset.year);
    const newTotal = Number(event.target.value) || 0;

    this.yearTables = this.yearTables.map(y => {
        if (y.year === year) {
            const perQuarter = parseFloat((newTotal / 4).toFixed(2));
            const percent = this.plannedBudget > 0
                ? parseFloat(((newTotal / this.plannedBudget) * 100).toFixed(2))
                : 0;

            return {
                ...y,
                totalBudget: parseFloat(newTotal.toFixed(2)),
                percent: percent,
                isQuarterManuallyEdited: false,
                quarters: y.quarters.map(q => ({
                    ...q,
                    amount: perQuarter
                }))
            };
        }
        return y;
    });
}

handleYearPercentChange(event) {
    const year = Number(event.target.dataset.year);
    const newPercent = Number(event.target.value) || 0;

    this.yearTables = this.yearTables.map(y => {
        if (y.year === year) {
            const total = parseFloat(((this.plannedBudget * newPercent) / 100).toFixed(2));
            const perQuarter = parseFloat((total / 4).toFixed(2));

            return {
                ...y,
                percent: parseFloat(newPercent.toFixed(2)),
                totalBudget: total,
                isQuarterManuallyEdited: false, 
                quarters: y.quarters.map(q => ({
                    ...q,
                    amount: perQuarter
                }))
            };
        }
        return y;
    });
}


handleLeadTargetChange(event) {
    const year = Number(event.target.dataset.year);
    const newLeadTarget = Number(event.target.value) || 0;

    this.yearTables = this.yearTables.map(y => {
        if (y.year === year) {
            return {
                ...y,
                leadTarget: newLeadTarget
            };
        }
        return y;
    });
}

// loadExistingBudget() {
//     getBudgetForEdit({ budgetId: this.recordId })
//         .then(result => {

//             const b = result.budget;

//             this.marketingPercent = b.Marketing_Expense_Budget_Percentage__c;
//             this.marketingAmount = b.Marketing_Expense_Planned_Budget__c;
//             this.cpPercent = b.CP_Expense_Budget_Percantage__c;
//             this.cpAmount = b.CP_Expense_Planned_Budget__c;
//             this.otherPercent = b.Other_Expense_Marketing_Budget_Percentag__c;
//             this.otherAmount = b.Other_Expense_Marketing_Planned_Budget__c;

//             // 🔹 KEEP YOUR CALCULATION FLOW
//             this.calculateAmounts();

//             this.numberOfYears = result.yearly.length;

//             this.yearTables = result.yearly.map((y, index) => ({
//                 year: index + 1,
//                 percent: y.Plannned_Budget_for_Online_Offline__c,
//                 totalBudget: y.Plannned_Budget_for_Online_Offline_value__c,
//                 leadTarget: y.Lead_Gen_Target__c,
//                 isQuarterManuallyEdited: true,
//                 quarters: [
//                     { label: `Y${index + 1}Q1`, amount: y.Quater1__c },
//                     { label: `Y${index + 1}Q2`, amount: y.Quater2__c },
//                     { label: `Y${index + 1}Q3`, amount: y.Quater3__c },
//                     { label: `Y${index + 1}Q4`, amount: y.Quater4__c }
//                 ]
//             }));
//         })
//         .catch(error => {
//             console.error(error);
//         });
// }

get plannedBudget() {
    return parseFloat((this.marketingAmount - this.cpAmount - this.otherAmount || 0).toFixed(2));
}

get usedBudget() {
    return this.yearTables.reduce((sum, y) => sum + (y.totalBudget || 0), 0);
}

get remainingBudget() {
    const remaining = this.plannedBudget - this.usedBudget;
    return remaining > 0 ? parseFloat(remaining.toFixed(2)) : 0;
}



}
