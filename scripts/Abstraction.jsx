import React, {Component} from 'react';
import {Render} from 'react-dom';
import {Link} from 'react-router';
import {Menu, MenuItem, Popover, Button, Position} from '@blueprintjs/core';

import Visualizer from './Visualizer.jsx';


export default class Abstraction extends Visualizer {
  constructor(props) {
    super(props);
    this.state.abstraction = true;
    this.onObjectDoubleClicked = this.onObjectDoubleClicked.bind(this)
  }

  componentDidMount() {
    /*
     As soon as the component is mounted, request the schema from the server. If an error occurs, render an alert.
     */
    if(!this.state.abstraction){
      return;
    } else {
      fetch('http://localhost:5001/schema')
        .then((resp) => {
          return resp.json();
        })
        .then((resp) => {
          if (resp.error) {
            this.setState({error: resp.error, loading: false});
          } else {
            let abstraction = this.getAbstraction(resp.schema);
            this.setState({
              serverResponse: resp,
              schema: abstraction,
              links: abstraction.links,
              loading: false
            });
          }
        })
        .catch((e) => {
          console.log(e);
          this.setState({error: 'An Unknown error has occured.', loading: false});
        });
    }
  }

  getCanvasTableData() {
    if(!this.state.abstraction){
      let data = super.getCanvasTableData();
      return data;
    }
    let data = [];
    let entities = this.state.schema.abstractEntities;
    let relationships = this.state.schema.abstractRelationships;
    if (!entities && !relationships) return data;

    Object.keys(entities).forEach((key)=>{
      let node = {};
      node.key = key;
      node.items = [];
      node.category = "entity";

      for (let i = 0; i < entities[key].properties.length; i++){
        let table = {};
        table.name = entities[key].properties[i].name;
        node.items.push(table);
      }

      data.push(node);
    });

    Object.keys(relationships).forEach((key)=>{
      let node = {};
      node.key = key;
      node.items = [];
      node.category = "relationship";

      for (let i = 0; i < relationships[key].properties.length; i++){
        let table = {};
        table.name = relationships[key].properties[i].name;
        node.items.push(table);
      }

      data.push(node);
    });
    return data;
  }

  getCanvasLinkData() {
    let links = this.state.links;
    if(!this.state.abstraction){
      links = super.getCanvasLinkData();
    }
    return links;
  }

  onObjectDoubleClicked(e) {
    let newSchema = {};
    const getTablesFromEntity = (name)=>{
      let tablesInEntity = [];
      let entities = this.state.schema.abstractEntities;
      let relationships = this.state.schema.abstractRelationships;

      console.log(entities);
      console.log(name);

      if (entities && entities.hasOwnProperty(name)){
        for(let i = 0; i < entities[name].properties.length; i++){
          tablesInEntity.push(entities[name].properties[i].name);
        }
      } else if (relationships && relationships.hasOwnProperty(name)){
        for(let i = 0; i < relationships[name].properties.length; i++){
          tablesInEntity.push(relationships[name].properties[i].name);
        }
      }
      console.log(tablesInEntity);
      return tablesInEntity;
    };

    let entityName = e.subject.me;
    if (!entityName){
      // For some reason, entity name isn't always available on the diagram event. If this is the case, use the last
      // touched node
      entityName = localStorage.getItem('lastTouched');
    }

    let tablesInEntity = getTablesFromEntity(entityName);
    Object.keys(this.state.serverResponse.schema).forEach((x)=>{
      if (tablesInEntity.indexOf(x) !== -1){
        newSchema[x] = this.state.serverResponse.schema[x];
      }
    });


    this.setState({abstraction: false, schema: newSchema});
  }

  getAbstraction(schema) {
    let abstractRelationships = {};
    let abstractEntities = {};
    let links = [];

    const getPKs = (tableCols) => {
      let pks = [];

      for (let i = 0; i < tableCols.length; i++) {
        if (tableCols[i].key === "PRI") pks.push(tableCols[i].name);
      }
      return pks;
    };

    const pkCompare = (a, b) => {
      let aLength = a.primaryKeys.length;
      let bLength = b.primaryKeys.length;

      if (aLength < bLength) {
        return -1;
      } else if (bLength < aLength) {
        return 1;
      }

      for (let i = 0; i < aLength; i++) {
        let cmp = a.primaryKeys[i].localeCompare(b.primaryKeys[i]);
        if (cmp !== 0) {
          return cmp;
        }
      }

      return 0;
    };

    const orderAscPK = (tables) => {
      tables.sort((a, b) => {
        return pkCompare(a, b);
      })
    };

    const anyPKsSharedWithRelation = (a, b) => {
      for (let i = 0; i < a.primaryKeys.length; i++) {
        for (let j = 0; j < b.primaryKeys.length; j++) {
          let cmp = a.primaryKeys[i].localeCompare(b.primaryKeys[j]);
          if (cmp === 0) {
            return true;
          }
        }
      }
      return false;
    };

    const anyPKsSharedWithAbstractEntity = (relation, entity) => {
      for (let i in entity) {
        if (anyPKsSharedWithRelation(relation, entity[i]) === true) {
          return true
        }
      }
      return false;
    };

    let tables = {};
    for (let table in schema) {
      tables[table] = {name: table, properties: schema[table], primaryKeys: getPKs(schema[table])}
    }

    let tablesList = [];
    for (var i in tables) {
      tablesList.push(tables[i]);
    }

    let disjoint = false;
    orderAscPK(tablesList);
    let orderedRels = tablesList;
    let remainingRels = orderedRels.slice();


    let cluster = [];
    for (let i in tablesList) {
      cluster.push([]);
    }

    cluster[0].push(orderedRels[0]);
    let numAbstractEntities = 1;
    remainingRels.shift();

    for (let i = 0; i < orderedRels.length; i++) {
      let relation = orderedRels[i];
      if (pkCompare(relation, cluster[numAbstractEntities - 1][0]) == 0) {
        cluster[numAbstractEntities - 1].push(relation);
        remainingRels = remainingRels.filter((x) => {
          return x.name !== relation.name
        });
      } else {
        disjoint = true;
        for (let s = 0; s < numAbstractEntities; s++) {
          if (anyPKsSharedWithAbstractEntity(relation, cluster[s])) {
            disjoint = false;
          }
        }

        if (disjoint) {
          cluster[numAbstractEntities].push(relation);
          numAbstractEntities++;
          remainingRels = remainingRels.filter((x) => {
            return x.name !== relation.name;
          });
        }
      }
    }


    for (let r = 0; r < remainingRels.length; r++) {
      let relation = remainingRels[r];

      let i = 0;
      let isAbstractRelation = false;
      let foundClusterIdx = -1;

      while (i < numAbstractEntities && !isAbstractRelation) {
        if (anyPKsSharedWithAbstractEntity(relation, cluster[i])) {
          if (foundClusterIdx === -1) {
            foundClusterIdx = i;
          } else {
            isAbstractRelation = true;
          }
        }
        i++;
      }

      if (!isAbstractRelation) {
        cluster[foundClusterIdx].push(relation);
        remainingRels = remainingRels.filter((x) => {
          return x.name !== relation.name;
        });
        r--;
      }
    }


    let argument = [];
    let intersects = [];
    let numAbstractRelationships = 0;
    for (let i = 0; i < tablesList.length; i++) {
      argument.push([]);
      for (let j = 0; j < numAbstractEntities; j++) {
        argument[i].push(false);
        if (i === 0) {
          intersects.push(false);
        }
      }
    }

    let firstRelationship = true;
    for (let r = 0; r < remainingRels.length; r++) {
      for (let i in intersects) {
        intersects[i] = false;
      }

      let relation = remainingRels[r];

      for (let i = 0; i < numAbstractEntities; i++) {
        if (anyPKsSharedWithAbstractEntity(relation, cluster[i])) {
          intersects[i] = true;
        }
      }
      if (firstRelationship) {
        for (let i = 0; i < numAbstractEntities; i++) {
          argument[0][i] = intersects[i];
        }
        cluster[numAbstractEntities + numAbstractRelationships].push(relation);
        numAbstractRelationships++;
        remainingRels = remainingRels.filter((x) => {
          return x.name !== relation.name
        });
        r--;
        firstRelationship = false;
      } else {
        let j = 0;
        let found = false;

        while (j < numAbstractRelationships && !found) {
          let inRelationship = true;

          for (let i in intersects) {
            if (intersects[i] !== argument[j][i]) {
              inRelationship = false;
              break;
            }
          }

          if (inRelationship) {
            cluster[numAbstractEntities + j].push(relation);
            remainingRels = remainingRels.filter((x) => {
              return x.name !== relation.name;
            });
            r--;
            found = true;
          }
          j++;
        }

        if (!found) {
          for (let i = 0; i < numAbstractEntities; i++) {
            argument[numAbstractRelationships][i] = intersects[i];
          }
          cluster[numAbstractEntities + numAbstractRelationships].push(relation);
          numAbstractRelationships++;
          remainingRels = remainingRels.filter((x) => {
            return x.name !== relation.name
          });
          r--;
        }
      }
    }

    for (let i = 0; i < cluster.length; i++) {
      let tag = '';
      if (i < numAbstractEntities) {
        tag = "AE" + (i + 1);
      } else {
        tag = "AR" + ((i - numAbstractEntities) + 1);
      }

      if (cluster[i].length > 0) {
        let newTable = {
          name: tag,
          key: tag,
          properties: []
        };
        for (let j = 0; j < cluster[i].length; j++) {
          newTable.properties.push({
            name: cluster[i][j].name,
          });
        }

        if (i < numAbstractEntities) {
          abstractEntities[tag] = newTable;
        } else {
          let ar = this.state.abstractRelationships;
          abstractRelationships[tag] = newTable;
        }
      }
    }

    for (let i = 0; i < numAbstractEntities; i++) {
      for (let j = 0; j < argument[i].length; j++) {
        if (argument[i][j]) {
          links.push({
            from: "AE" + (j + 1),
            to: "AR" + (i + 1),
            relationship: "generalization"
          });
        }
      }
    }
    return {abstractRelationships: abstractRelationships, abstractEntities: abstractEntities, links: links};
  }

};
