public with sharing class BudgetController {
    
    @AuraEnabled
    public static Id saveBudget(
        Id projectId, 
        Decimal marketingPercent,
        Decimal marketingAmount,
        Decimal cpPercent,
        Decimal cpAmount,
        Decimal otherPercent,
        Decimal otherAmount,
        String yearDistributions
    ) {
        Project__c bg;
        try {
            bg = [SELECT Id, Name FROM Project__c WHERE Id = :projectId LIMIT 1];
        } catch (Exception e) {
            throw new AuraHandledException('Project record not found for Id: ' + projectId);
        }
        
        
        try {
            
            Integer existingCount = [
                SELECT COUNT() 
                FROM Budget__c 
                WHERE Project__c = :projectId
            ];
            Integer nextVersion = existingCount + 1;
            
            Budget__c budget = new Budget__c();
            budget.Project__c = projectId; 
            budget.Marketing_Expense_Budget_Percentage__c = marketingPercent;
            budget.Marketing_Expense_Planned_Budget__c = marketingAmount;
            budget.CP_Expense_Budget_Percantage__c = cpPercent;
            budget.CP_Expense_Planned_Budget__c = cpAmount;
            budget.Active__c= true;
            budget.Other_Expense_Marketing_Budget_Percentag__c = otherPercent;
            budget.Other_Expense_Marketing_Planned_Budget__c = otherAmount;
            budget.Planned_Budget_for_Online_and_Offline__c =
                marketingAmount - cpAmount - otherAmount;
            budget.Name = bg.Name + ' Budget Version ' + nextVersion;
            
            insert budget;
            
            List<Budget__c> oldBudgets = [
                SELECT Id
                FROM Budget__c
                WHERE Project__c = :projectId
                AND Id != :budget.Id
                AND Active__c = TRUE
            ];
            
            for (Budget__c b : oldBudgets) {
                b.Active__c = FALSE;
            }
            
            if (!oldBudgets.isEmpty()) {
                update oldBudgets;
            }
            
            
            if (String.isBlank(yearDistributions)) {
                return budget.Id;
            }
            
            List<Object> years =
                (List<Object>) JSON.deserializeUntyped(yearDistributions);
            
            if (years == null || years.isEmpty()) {
                return budget.Id;
            }
            
            List<Marketing_Expense_Distribution_Yearly__c> yearlyRecords =
                new List<Marketing_Expense_Distribution_Yearly__c>();
            
            for (Object obj : years) {
                Map<String, Object> yearMap =
                    (Map<String, Object>) obj;
                
                Integer year =
                    Integer.valueOf(String.valueOf(yearMap.get('year')));
                Decimal percent =
                    Decimal.valueOf(String.valueOf(yearMap.get('percent')));
                Decimal totalBudget =
                    Decimal.valueOf(String.valueOf(yearMap.get('totalBudget')));
                
                List<Object> quarters =
                    (List<Object>) yearMap.get('quarters');
                
                Marketing_Expense_Distribution_Yearly__c yRec =
                    new Marketing_Expense_Distribution_Yearly__c();
                
                yRec.Budget__c = budget.Id;
                yRec.Name = 'Year ' + year;
                yRec.Plannned_Budget_for_Online_Offline__c = percent;
                yRec.Plannned_Budget_for_Online_Offline_value__c = totalBudget;
                
                if (yearMap.containsKey('leadTarget') && yearMap.get('leadTarget') != null) {
                    yRec.Lead_Gen_Target__c =
                        Integer.valueOf(String.valueOf(yearMap.get('leadTarget')));
                } else {
                    yRec.Lead_Gen_Target__c = 0;
                }
                
                // Quarters
                yRec.Quater1__c = Decimal.valueOf(String.valueOf(
                    ((Map<String, Object>) quarters[0]).get('amount')
                ));
                yRec.Quater2__c = Decimal.valueOf(String.valueOf(
                    ((Map<String, Object>) quarters[1]).get('amount')
                ));
                yRec.Quater3__c = Decimal.valueOf(String.valueOf(
                    ((Map<String, Object>) quarters[2]).get('amount')
                ));
                yRec.Quater4__c = Decimal.valueOf(String.valueOf(
                    ((Map<String, Object>) quarters[3]).get('amount')
                ));
                
                
                yearlyRecords.add(yRec);
            }
            
            if (!yearlyRecords.isEmpty()) {
                insert yearlyRecords;
            }
            
            return budget.Id;
            
        } catch (Exception e) {
            throw new AuraHandledException(
                'Error saving budget: ' + e.getMessage()
            );
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static Budget_Calculation__mdt getDefaultBudget() {
        try {
            return [
                SELECT Marketing_Expense_Budget_Percentage__c,
                CP_Expense_Budget_Percantage__c,
                Other_Expense_Marketing_Budget_Percentag__c
                FROM Budget_Calculation__mdt
                WHERE DeveloperName = 'default'
                LIMIT 1
            ];
        } catch (Exception e) {
            throw new AuraHandledException(
                'Error fetching default budget: ' + e.getMessage()
            );
        }
    }
    
    /* @AuraEnabled(cacheable=true)
public static Map<String, Object> getBudgetForEdit(Id budgetId) {
Map<String, Object> result = new Map<String, Object>();

Budget__c budget = [
SELECT Id, Project__c, Project_Cost__c,
Marketing_Expense_Budget_Percentage__c,
Marketing_Expense_Planned_Budget__c,
CP_Expense_Budget_Percantage__c,
CP_Expense_Planned_Budget__c,
Other_Expense_Marketing_Budget_Percentag__c,
Other_Expense_Marketing_Planned_Budget__c
FROM Budget__c
WHERE Id = :budgetId
LIMIT 1
];

List<Marketing_Expense_Distribution_Yearly__c> yearly = [
SELECT Name,
Plannned_Budget_for_Online_Offline__c,
Plannned_Budget_for_Online_Offline_value__c,
Lead_Gen_Target__c,
Quater1__c, Quater2__c, Quater3__c, Quater4__c
FROM Marketing_Expense_Distribution_Yearly__c
WHERE Budget__c = :budgetId
ORDER BY CreatedDate ASC
];

result.put('budget', budget);
result.put('yearly', yearly);
return result;
}*/
    
}
