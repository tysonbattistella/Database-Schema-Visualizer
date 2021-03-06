import React, {Component} from 'react';
import {render} from 'react-dom';

export default class Canvas extends Component {
  constructor(props) {
    super(props);
    this.state = {
      onPersistNameSubmit: props.nameSubmitCallback,
      layoutName: '',
      layouts: props.layouts
    };
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  handleSubmit(event) {
    event.preventDefault();
    let name = this.state.layoutName;
    let currentModel = JSON.parse(localStorage.getItem('currentModel'));
    if (name.length > 0 && currentModel) {
      let newLayout = {};
      newLayout.isDefault = false;
      newLayout.displayName = name;
      newLayout.layoutKey = name;
      newLayout.model = currentModel;
      let layouts = this.state.layouts;

      // if layouts have the same name, remove the stale one and update with the new one
      for (let i=0; i<layouts.length; i++){
        if (layouts[i].displayName === name){
          layouts.splice(i, 1);
        }
      }
      layouts.push(newLayout);
      this.state.onPersistNameSubmit(layouts, newLayout);
    }
  }

  handleChange(event) {
    /*
     Helper function to synchronize form values to state variables
     */
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;
    this.setState({[name]: value});
  }

  render() {
    return (
      <div>
        <h5>Persist this layout</h5>
        <form onSubmit={this.handleSubmit}>
          <label className="pt-label">
            Layout Name
            <input name="layoutName" value={this.state.layoutName} type="text" className="pt-input"
                   onChange={this.handleChange}/>
          </label>
        </form>
        <button className="pt-button pt-intent-primary" onClick={this.handleSubmit}>Save</button>
        <button className="pt-button pt-popover-dismiss float-right">Dismiss</button>
      </div>
    )
  }
}
