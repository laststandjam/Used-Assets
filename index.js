
var items = [];
var items_wmc = [];
var items_final = [];
var orphaned = false;
var lang = "";
var langids = [];
var project = "";
var key = "";


let basePath = ""
const targetTypes = new Set()
const targetElements = []
const variantResponse = []
let assets

// targets = [{type:}]

$(document).ready(function () {

	//Set variables from form
	$("#submit").click(function () {

		items = [];
		items_wmc = [];
		items_final = [];
		lang = $("#lang").val();
		project = $("#project").val();
		basePath = 'https://manage.kontent.ai/v2/projects/' + project
		key = $("#prev").val();
		langids = [];
		orphaned = $("#orphaned").is(':checked');
		$("#tables").html("");
		$("#msg").html("");
		loadTypes();
		$('.overlay').show();

	});

	//delete Assets Confirmation
	$("#confirmationButton").click(function(){
		deleteOrpahnedAssets()
	})

	//canel delete Assets
	$("#cancelButton").click(function(){
		$(".deletionOverlay").hide()
	})


});



//get types we need to check for assets
function loadTypes() {
	$.ajax({
		url: basePath + "/types",
		dataType: 'text',
		beforeSend: function (xhr, settings) {
			if (key) {
				xhr.setRequestHeader('Authorization', 'Bearer ' + key);
			}
		},
		success: function (data, textStatus, request) {
			data = JSON.parse(data);
			if (data.types.length > 0) {
				for (var x = 0; x < data.types.length; x++) {
					let currentType = data.types[x];

					for (let i = 0; i < currentType.elements.length; i++) {
						let currentElement = currentType.elements[i];

						if (currentElement.type === "asset" || currentElement.type === "rich_text") {
							let hit = {
								typeID: currentType.id,
								elements: [{
									elementID: currentElement.id,
									elementType: currentElement.type
								}]
							};

							let obj = targetElements.find(obj => obj.typeID === hit.typeID);
							if (obj) {
								// Check if an element with the same elementID already exists
								let elemObj = obj.elements.find(elem => elem.elementID === hit.elements[0].elementID);
								if (!elemObj) {
									obj.elements.push(hit.elements[0]);
								}
							} else {
								targetTypes.add(currentType.id);
								targetElements.push(hit);
							}
						}
					}
				}
				loadItemVariants();
			}
		}
	});
}


// const mergeData = () => {
// 	for (const langid of langids) {
// 		for (const targetElement of targetElements) {
// 			console.log('merge data hit targetElmenent', targetElement)
// 			requestData.push({ typeID: targetElement.typeID, elementID: targetElement.elementID, langID: langid, elmentType: targetElement.elmentType })
// 		}
// 	}
// 	console.log('requestdata', requestData)
// 	loadItemVariants()
// }

const loadItemVariants = async () => {
	// grab unique types
	const reqTypes = [...targetTypes];
	let continuationToken = null; // initialize the continuation token
  
	try {
	  while (true) {
		// get all variants of each type
		const responses = await Promise.all(reqTypes.map(async (req) => {
		  const response = await $.ajax({
			url: basePath + `/types/${req}/variants`,
			dataType: 'text',
			// key and header go here
			beforeSend: function (xhr, settings) {
			  if (key) {
				xhr.setRequestHeader('Authorization', 'Bearer ' + key);
			  }
			},
			// add the continuation token to the request
			data: {
			  continuationToken: continuationToken
			}
		  });
  
		  // success logic goes here
		  let returnedElement = JSON.parse(response);
		  return {
			type: req,
			variants: returnedElement.variants
		  };
		}));
  
		processVariants(responses);
  
		// check if there is a continuation token in the response
		const lastResponse = responses[responses.length - 1];
		if (lastResponse && lastResponse.continuationToken) {
		  continuationToken = lastResponse.continuationToken;
		} else {
		  break; // exit the loop if there is no continuation token
		}
	  }
	} catch (error) {
	  $('#msg').html(
		'No data found. Please make sure you have the correct project id, language, and the secured access is turned off (or provide a preview token).'
	  );
	  $('.overlay').hide();
	}
  };
  



// function loadItems(project, lang, xc, key) {
// 	var url = 'https://' + (key ? 'preview-' : '') + 'deliver.kontent.ai/' + project + '/items-feed' + (lang ? '?language=' + lang : '');
// 	$.ajax({
// 		url: url,
// 		dataType: 'text',
// 		beforeSend: function (xhr, settings) {
// 			if (xc) {
// 				xhr.setRequestHeader('X-Continuation', xc);
// 			}
// 			if (key) {
// 				xhr.setRequestHeader('Authorization', 'Bearer ' + key);
// 			}
// 		},
// 		success: function (data, textStatus, request) {
// 			data = JSON.parse(data);
// 			if (data.items.length > 0) {
// 				processItems(data.items);
// 				var xc = request.getResponseHeader('X-Continuation');
// 				if (xc) {
// 					loadItems(project, lang, xc, key);
// 				}
// 				else {
// 					countItems();
// 				}
// 			}
// 			else {
// 				console.log("no data found");
// 				$("#msg").html("No data found. Please make sure your project has items in specified language.");
// 				$('.overlay').hide();
// 			}
// 		},
// 		error: function (jqXHR, textStatus, errorThrown) {
// 			$("#msg").html("No data found. Please make sure you have correct project id, language and the secured access is turned off (or provide preview token).");
// 			$('.overlay').hide();
// 		}
// 	});
// }

function processVariants(data) {
	console.log('processVariants hit')
	console.log(targetElements)
	targetElements.forEach(targetType => {



		targetType.elements.forEach(targetElement => {
			console.log("ele", targetElement)
			const match = data.find(responseType => responseType.type === targetType.typeID)

			match.variants.forEach(responseVariant => {
				const found = responseVariant.elements.find(responseElement => responseElement.element.id === targetElement.elementID)


				// if target element is an array push the asset id 
				//note will need to add another loop to create an assetItem for mutiple assets
				if (targetElement.elementType === 'asset') {

					found.value.forEach(asset => {
						const assetItem = {
							itemID: responseVariant.item.id,
							assetValue: asset.id,
							langID: responseVariant.language.id,
							itemURL: `https://app.kontent.ai/${project}/content-inventory/${responseVariant.language.id}/content/${responseVariant.item.id}`
						}
						items.push(assetItem)
					})

				} else if (targetElement.elementType === 'rich_text' && found.value.includes('data-asset-id')) {
					console.log("wath this", found)
					console.log(responseVariant.item.id)
					const regex = /\"(.*?)\"/
					const assetItem = {
						itemID: responseVariant.item.id,
						assetValue: regex.exec(found.value)[1],
						langID: responseVariant.language.id,
						itemURL: `https://app.kontent.ai/${project}/content-inventory/${responseVariant.language.id}/content/${responseVariant.item.id}`

					}
					regex.exec(found.value)
					items.push(assetItem)

				} else if (targetElement.elementType === 'rich_text' && found.components.length > 0) {
					console.log('component hit', found)



					found.components.forEach(component => {
						//figure out what Item Type the Component is 
						const componentType = targetElements.find(targetElement => targetElement.typeID === component.type.id)
						console.log("componet type", componentType)

						component.elements.forEach(element => {
							const componentElement = componentType.elements.find(targetElement => element.element.id === targetElement.elementID)
							

							if(componentElement){
								console.log("check out this element type", componentElement)
							if (componentElement.elementType === "rich_text" && found.value.includes('data-asset-id')) {
								const regex = /\"(.*?)\"/
								const assetItem = {
									itemID: responseVariant.item.id,
									assetValue: regex.exec(found.value)[1],
									langID: responseVariant.language.id,
									itemURL: `https://app.kontent.ai/${project}/content-inventory/${responseVariant.language.id}/content/${responseVariant.item.id}`

								}
								regex.exec(found.value)
								items.push(assetItem)
							} else if (componentElement.elementType=== "asset") {
								console.log('hit component asset', element)
								element.value.forEach(asset=>{
									const assetItem = {
									itemID: responseVariant.item.id,
									assetValue: asset.id,
									langID: responseVariant.language.id,
									itemURL: `https://app.kontent.ai/${project}/content-inventory/${responseVariant.language.id}/content/${responseVariant.item.id}`
								}
									console.log(assetItem)
								items.push(assetItem)
								})
								
							
							}}
						})


					})
					



				}


			})
		})



	})
	loadAssets()
	// buildTable()
}

const loadAssets = (xc) => {
	var url = basePath + "/assets";
	
	$.ajax({
	  url: url,
	  dataType: 'text',
	  beforeSend: function (xhr, settings) {
		if (xc) {
		  xhr.setRequestHeader('X-Continuation', xc);
		}
		if (key) {
		  xhr.setRequestHeader('Authorization', 'Bearer ' + key);
		}
	  },
	  success: function (data, textStatus, request) {
		data = JSON.parse(data);
		
		if (data.assets.length > 0) {
		  var xc = request.getResponseHeader('X-Continuation');
		  if (xc) {
			loadAssets(xc);
		  } else {
			assets = data.assets;
			processAssets();
		  }
		} else {
		  console.log("No Assets found");
		  $("#msg").html("No Assets found. Please make sure your project has items in the specified language.");
		  $('.overlay').hide();
		}
	  },
	  error: function (jqXHR, textStatus, errorThrown) {
		$("#msg").html("No data found. Please make sure you have the correct project id, language, and the secured access is turned off (or provide a preview token).");
		$('.overlay').hide();
	  }
	});
  };
  

const processAssets = () => {

	const results = assets.forEach(asset => {
		const item = items.find(item => item.assetValue === asset.id);

		if (item) {
			// Add the value from asset to the matching item in items
			item.assetName = asset.file_name // Replace "value" with the appropriate property name in the asset object
		} else {

			items.push({
				assetValue: asset.id,
				assetName: asset.file_name,
				itemURL: "N/A",
				itemID: "N/A"
			})
		}


	});

	buildTable()
}

const buildTable = () => {


	const table = document.createElement('table');
	const tableHeader = table.createTHead();
	const tableBody = table.createTBody();
	const headers = ['Asset ID', 'Item ID', 'Item URL'];

	const headerRow = tableHeader.insertRow();
	headers.forEach(header => {
		const th = document.createElement('th');
		th.textContent = header;
		headerRow.appendChild(th);
	});

	//check if oprhaned box is check and remove non orphaned values
	if(orphaned){
		items=items.filter(item=> item.itemURL==="N/A")
	}

	items.forEach(rowData => {
		const row = tableBody.insertRow();
		const { itemID, assetValue, itemURL } = rowData;
		[assetValue, itemID, itemURL].forEach(value => {
			const cell = row.insertCell();
			cell.textContent = value;
		});
	});
	$("#tables").append(table);
	$('.overlay').hide();

	orphanCheck =items.find(item=>item.itemURL === "N/A")
	console.log(orphanCheck)
	if(orphanCheck){
	const deleteButton = $('<button/>').text("Delete Assets").on("click", function(){
	$(".deletionOverlay").show()
	}).prop({id:"deleteButton"});
	$("#deleteButtonContainer").append(deleteButton)
	}
}


const deleteOrpahnedAssets = ()=> {

	console.log('hit me ')
	orphanedAssets = items.filter(item=> item.itemURL==="N/A")
	var url = basePath + "/assets"

	orphanedAssets.forEach(asset=>
		
		$.ajax({
			url:url+`/${asset.assetValue}`,
			dataType: "Text",
			type:'DELETE',
			beforeSend: function(xhr)
			{ if (key) {
				xhr.setRequestHeader('Authorization', 'Bearer ' + key);}
			},success: function (data, textStatus, request) {

				console.log(asset.value, "deleted")
			}

		}))
		$(".deletionOverlay").hide()
		$("#deleteButton").remove()


}

function processItems(data) {
	for (var x = 0; x < data.length; x++) {
		for (const key in data[x].elements) {
			if (data[x].elements[key].type == "modular_content") {
				for (var y = 0; y < data[x].elements[key].value.length; y++) {
					items_wmc.push([data[x].system.codename, data[x].system.name, data[x].system.id, data[x].elements[key].value[y], data[x].system.language]);
				}
			}
			if (data[x].elements[key].type == "rich_text") {
				for (var y = 0; y < data[x].elements[key].modular_content.length; y++) {
					items_wmc.push([data[x].system.codename, data[x].system.name, data[x].system.id, data[x].elements[key].modular_content[y], data[x].system.language]);
				}
			}
		}
		items.push([data[x].system.codename, data[x].system.name, data[x].system.id, data[x].system.language]);
	}

}

function countItems() {
	if (orphaned) {
		for (var x = 0; x < items.length; x++) {
			var isUsed = false;
			for (var y = 0; y < items_wmc.length; y++) {
				if (items[x][0] == items_wmc[y][3]) {
					isUsed = true;
				}
			}
			if (!isUsed) {
				items_final.push([returnLink(items[x][1], items[x][2]), items[x][0], "not used anywhere"]);
			}
		}
	}
	else {
		for (var x = 0; x < items.length; x++) {
			var isUsed = false;
			var usedIn = [];
			for (var y = 0; y < items_wmc.length; y++) {
				if (items[x][0] == items_wmc[y][3]) {
					isUsed = true;
					usedIn.push(returnLink(items_wmc[y][1], items_wmc[y][2], items_wmc[y][4]));
				}
			}
			if (!isUsed) {
				items_final.push([returnLink(items[x][1], items[x][2], items[x][3]), items[x][0], "not used anywhere"]);
			}
			else {
				items_final.push([returnLink(items[x][1], items[x][2], items[x][3]), items[x][0], usedIn.join(", ")]);
			}
		}
	}
	buildData(0);
}




// function returnLink(name, id, lang) {
// 	var langid = "00000000-0000-0000-0000-000000000000";
// 	for (var x = 0; x < langids.length; x++) {
// 		if (langids[x][0] == lang) {
// 			langid = langids[x][1];
// 		}
// 	}
// 	return "<a href='https://app.kontent.ai/" + project + "/content-inventory/" + langid + "/content/" + id + "' target='_blank'>" + name + "</a>";
// }

// function buildData(index) {
// 	var table = '<table class="display compact" id="table">';
// 	var xml = '<items>\n';
// 	table += '<thead>';
// 	table += '<tr>';
// 	table += '<th>Item name</th>';
// 	table += '<th>Item codename</th>';
// 	table += '<th>Used in item</th>';
// 	table += '</tr>';
// 	table += '</thead>';
// 	table += '<tbody>';
// 	for (var y = index; y < items_final.length; y++) {
// 		table += '<tr>';
// 		xml += '\t<item>\n';

// 		table += '<td>';
// 		xml += '\t\t<item>\n';
// 		table += items_final[y][0];
// 		xml += items_final[y][0];
// 		table += '</td>';
// 		xml += '\t\t</item>\n';

// 		table += '<td>';
// 		xml += '\t\t<item_codename>\n';
// 		table += items_final[y][1];
// 		xml += items_final[y][1];
// 		table += '</td>';
// 		xml += '\t\t</item_codename>\n';

// 		table += '<td>';
// 		xml += '\t\t<used_in_item>\n';
// 		table += items_final[y][2];
// 		xml += items_final[y][2];
// 		table += '</td>';
// 		xml += '\t\t</used_in_item>\n';

// 		table += '</tr>';
// 		xml += '\t</item>\n';
// 	}
// 	table += '</tbody>';
// 	table += '</table>';
// 	xml += '</items>';
// 	$("#tables").append(table);
// 	addExport(xml, index);
// 	$('.overlay').hide();
// }

// function addExport(xml, index) {
// 	$('#table').DataTable({
// 		dom: 'Bfrtip',
// 		buttons: [
// 			{
// 				extend: 'copyHtml5',
// 				title: 'Data export',
// 				text: '<i class="fa fa-files-o"></i>',
// 				titleAttr: 'Copy'
// 			},
// 			{
// 				extend: 'excelHtml5',
// 				title: 'Data export',
// 				text: '<i class="fa fa-file-excel-o"></i>',
// 				titleAttr: 'Excel'
// 			},
// 			{
// 				extend: 'pdfHtml5',
// 				title: 'Data export',
// 				text: '<i class="fa fa-file-pdf-o"></i>',
// 				titleAttr: 'PDF'
// 			},
// 			{
// 				text: '<i class="fa fa-file-code-o"></i>',
// 				titleAttr: 'XML',
// 				action: function (e, dt, node, config) {
// 					var w = window.open(null, null, config = 'height=600,width=800, addressbar=no');
// 					w.document.open("text/xml");
// 					w.document.write('<pre><code>' + escapeHtml(xml) + '</code></pre>');
// 					w.document.close();
// 				}
// 			},
// 			{
// 				extend: 'print',
// 				title: 'Data export',
// 				text: '<i class="fa fa-print"></i>',
// 				titleAttr: 'Print'
// 			}
// 		]
// 	});
// }

var entityMap = {
	'\n': '<br />',
	'\t': '&nbsp;',
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
	'/': '&#x2F;',
	'`': '&#x60;',
	'=': '&#x3D;'
};

function escapeHtml(string) {
	return String(string).replace(/[&<>"'`=\/]/g, function (s) {
		return entityMap[s];
	});
}