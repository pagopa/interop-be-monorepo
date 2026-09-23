# Catalog Process: endpoint

Elenco numerato degli endpoint esposti da `catalog-process`.

- Gli identificativi tra parentesi graffe sono parametri di path.
- Gli endpoint sono registrati in `src/routers/EServiceRouter.ts` tramite `catalogApi.processApi`.
- `/status` è registrato dal router health comune in `src/app.ts`.
- Ogni endpoint è seguito da una riga `TODO` da completare.

## Endpoint

1. `GET /status`
   TODO:

2. `GET /eservices`
   TODO:

3. `POST /eservices`
   TODO:

4. `POST /templates/{templateId}/eservices`
   TODO:

5. `GET /eservices/{eServiceId}`
   TODO:

6. `PUT /eservices/{eServiceId}`
   TODO:

7. `PATCH /eservices/{eServiceId}`
   TODO:

8. `POST /templates/eservices/{eServiceId}`
   TODO:

9. `DELETE /eservices/{eServiceId}`
   TODO:

10. `POST /eservices/{eServiceId}/scheduleArchive`
	TODO:

11. `POST /eservices/{eServiceId}/approveDelegatedArchiving`
	TODO:

12. `POST /eservices/{eServiceId}/rejectDelegatedArchiving`
	TODO:

13. `GET /eservices/{eServiceId}/consumers`
	TODO:

14. `POST /eservices/{eServiceId}/submitDelegatedArchiving`
	TODO:

15. `DELETE /eservices/{eServiceId}/submitDelegatedArchiving`
	TODO:

16. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/submitDelegatedArchiving`
	TODO:

17. `DELETE /eservices/{eServiceId}/descriptors/{descriptorId}/submitDelegatedArchiving`
	TODO:

18. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/approveDelegatedArchiving`
	TODO:

19. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/rejectDelegatedArchiving`
	TODO:

20. `GET /eservices/{eServiceId}/descriptors/{descriptorId}/documents/{documentId}`
	TODO:

21. `GET /eservices/{eServiceId}/descriptors/{descriptorId}/documents`
	TODO:

22. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/documents`
	TODO:

23. `DELETE /eservices/{eServiceId}/descriptors/{descriptorId}/documents/{documentId}`
	TODO:

24. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/documents/{documentId}/update`
	TODO:

25. `POST /eservices/{eServiceId}/descriptors`
	TODO:

26. `DELETE /eservices/{eServiceId}/descriptors/{descriptorId}`
	TODO:

27. `PUT /eservices/{eServiceId}/descriptors/{descriptorId}`
	TODO:

28. `PATCH /eservices/{eServiceId}/descriptors/{descriptorId}`
	TODO:

29. `POST /templates/eservices/{eServiceId}/descriptors/{descriptorId}`
	TODO:

30. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/publish`
	TODO:

31. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/suspend`
	TODO:

32. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/activate`
	TODO:

33. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/clone`
	TODO:

34. `POST /internal/eservices/{eServiceId}/descriptors/{descriptorId}/archive`
	TODO:

35. `POST /internal/eservices/{eServiceId}/delegatedArchivingRequests/archive`
	TODO:

36. `POST /internal/eservices/{eServiceId}/archive`
	TODO:

37. `POST /maintenance/eservices/{eServiceId}/descriptors/{descriptorId}/unarchive`
	TODO:

38. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/update`
	TODO:

39. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/scheduleArchive`
	TODO:

40. `POST /eservices/{eServiceId}/riskAnalysis`
	TODO:

41. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/agreementApprovalPolicy/update`
	TODO:

42. `POST /eservices/{eServiceId}/riskAnalysis/{riskAnalysisId}`
	TODO:

43. `POST /eservices/{eServiceId}/description/update`
	TODO:

44. `POST /eservices/{eServiceId}/delegationFlags/update`
	TODO:

45. `POST /eservices/{eServiceId}/name/update`
	TODO:

46. `POST /eservices/{eServiceId}/signalhub/update`
	TODO:

47. `DELETE /eservices/{eServiceId}/riskAnalysis/{riskAnalysisId}`
	TODO:

48. `POST /maintenance/eservices/{eServiceId}/riskAnalyses/{riskAnalysisId}/tenantKind/fix`
	TODO:

49. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/approve`
	TODO:

50. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/reject`
	TODO:

51. `POST /eservices/{eServiceId}/descriptors/{descriptorId}/attributes/update`
	TODO:

52. `PATCH /eservices/{eServiceId}/descriptors/{descriptorId}/certifiedAttributes/groups/{groupIndex}/attributes/{attributeId}`
	TODO:

53. `POST /templates/eservices/{eServiceId}/upgrade`
	TODO:

54. `POST /internal/templates/eservices/{eServiceId}/name/update`
	TODO:

55. `POST /internal/templates/eservices/{eServiceId}/description/update`
	TODO:

56. `POST /internal/templates/eservices/{eServiceId}/personalDataFlag`
	TODO:

57. `POST /internal/templates/eservices/{eServiceId}/descriptors/{descriptorId}/voucherLifespan/update`
	TODO:

58. `POST /internal/templates/eservices/{eServiceId}/descriptors/{descriptorId}/attributes/update`
	TODO:

59. `POST /internal/templates/eservices/{eServiceId}/descriptors/{descriptorId}/documents/update`
	TODO:

60. `DELETE /internal/templates/eservices/{eServiceId}/descriptors/{descriptorId}/documents/{documentId}/update`
	TODO:

61. `POST /internal/templates/eservices/{eServiceId}/descriptors/{descriptorId}/documents/{documentId}/update`
	TODO:

62. `POST /templates/eservices/{eServiceId}/descriptors/{descriptorId}/interface/soap`
	TODO:

63. `POST /templates/eservices/{eServiceId}/descriptors/{descriptorId}/interface/rest`
	TODO:

64. `POST /templates/eservices/{eServiceId}/descriptors`
	TODO:

65. `POST /templates/eservices/{eServiceId}/descriptors/{descriptorId}/update`
	TODO:

66. `POST /eservices/{eServiceId}/personalDataFlag`
	TODO:

67. `POST /templates/eservices/{eServiceId}/instanceLabel/update`
	TODO:

68. `DELETE /eservices/{eServiceId}/descriptors/{descriptorId}/scheduleArchive`
	TODO:

69. `DELETE /eservices/{eServiceId}/scheduleArchive`
	TODO:

70. `DELETE /maintenance/eservices/{eServiceId}/personalDataFlag`
	TODO:
