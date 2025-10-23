# Development Process

## Overview 
The team is developing a desktop application to accelerate the use of text chat and image LLMs in daily tasks for any Holokai LLM model. 

## Team
Dynamo 
* Product Manager - DK
* Team Lead - Peter Baxter 
* Business Analyst - Jon Teitelebaum and Michelle Apicella 
* CI/CD - Ken Ohnishi
* UX - Kevin Chard 

NKK
* Contract Manager - CLara N.
* Developer - Fynn (TBD) / NKK
* Developer - Kong (TBD) / NKK 

## Team Way of Working  

Kanban approach with a one week development cycle and some Scrum-style ceremonies.
The team should include assistance from AI to accelerate and support responsibilities. (A person is always responsible, not AI.)

* Dynamo - (weekly) Refinement and Prioritization
* Team - (daily) Stand Ups with Progress Updates in Slack
* Team -= (daily) Design, Code and Test in Github (issues, code, tests and evidence artifacts)
* Team - (weekly) Meeting for Planning + Retrospective
* Dynamo - (weekly/as needed) Development Verification/QA, Regression, End to End Testing

### Kanban Overview 
The team will follow a Kanban process which tracks the movement of backlog items to the "done" state. 
Kanban will use a development cycle of a week (not a Scrum sprint cadence).
Dynamo will maintain the development process and backlog with input and review from the development team. 

### Backlog Item States 
The team will maintain a state for each Backlog Item, which is one of:
* Defined:     backlog item where business and technical requirements are being developed, or are complete
* Ready:       assigned to the team for inclusion in a development cycle
* In-Progress: design or coding activities in progress
* Testing:     test automation or testing in progress
* Complete:    development complete and ready for verification
* Done:        item developed and verified, meets defintion of done
* Removed:     backlog item no longer considered valuable - no refinement or development 

## Requirements Flow 
Business requirements are organized as Epics consisting of Features consisting of Backlog Items. Features are organized into Releases. 

A Github "state" tag will be assigned to each backlog item. 
A Github "release" tag will be assigned to Epic(s), Feature(s) or Backlog Item(s) as appropriate.

## Requirements Refinement and Planning
Backlog items will be authoried and reviewed by Dynamo. "Defined" indicates that the backlog item is being authored or refined. 
A sample backlog item with required fields is in Github. 
Once a backlog item satisfies the dewfintion of ready, it must  be assigned a release tag, a priority and a state of "Ready". 

## Architecture and Design 
Architecture or design artifacts, when required, are developed, reviewed and checked into Github. 
Design should follow the ARCHIECTURE.md and CODING-INSTRUCTIONS.md guidance. 
Dynamo must approve modifications to ARCHITECTURE.md when needed.

## Coding and Test
Coding must include error free compilation and deployment to the development environment using CI/CD. 
Coding should be completed with the following artifacts:
- code, test data and tests in Github
- code review, either manual and/or AI
- a successful scan of a local SonarQube and eslint with an NVD score > 3.2 and no critical or high vulnerabilities
- a security assesment by Cursor or Claude 
- a report of 508 compliance
- new or updated unit test(s)
- end-to-end test(s) using playwright  

Code must be covered by 1) a unit test AND playwright; 2) playwright; 3) a "test n/a" attribute
Code test coverage should be 90% or greater. 

## Definitions 

### Definition of Ready 
A Backlog item that is "READY" has completed refinement and may be pulled into development.

"Ready" backlog items should have:
* id, title and description
* a single feature parent (e.g. not an orphan - must belong to a feature)
* acceptance criteria (clear, unambiguous and testable)
* release and priority
* ux/ui, Moku API and/or database design (when applicable)
* t-shirt size, points or estimated hours
* any dependencies are "ready", met or unblocked 

The referenced feature or epic should have a statement of user value, clear description and complete workflow

### Defintion of Done 
A Backlog item is "DONE" when:
* all functionaility in the backlog item has been implemented and verified
* code review completed
* the software has been merged and tested in development ebvironment through CI/CD
* code and artifacts have been checked into Github
* all tests pass and test coverage verified
* sonarqube, 508, security and playright success artifacts are attached to issue comments
* documentation has been udpated, when applicable

